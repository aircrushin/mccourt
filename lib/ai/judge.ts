import { generateText, Output } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import type { Participant, Recommendation, Verdict } from '@/lib/types/index';

export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || 'qwen/qwen3.7-flash:nitro';

const JudgeCopySchema = z.object({
  caseName: z.string().min(1).max(80),
  opening: z.string().min(1).max(240),
  opinions: z.array(z.string().min(1).max(160)).min(1).max(4),
  ruling: z.string().min(1).max(260),
  reasons: z.array(z.object({ participantId: z.string(), reason: z.string().min(1).max(180) })).min(1).max(4),
});

type JudgeCopy = z.infer<typeof JudgeCopySchema>;
type JudgeResult = { verdict: Verdict; judge: { engine: 'openrouter' | 'rules'; model: string | null; reason?: 'not_configured' | 'generation_failed' } };

function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function enrichVerdictWithOpenRouter(
  verdict: Verdict,
  participants: Participant[],
  recommendations: Recommendation[],
): Promise<JudgeResult> {
  if (!hasOpenRouterKey()) return { verdict, judge: { engine: 'rules', model: null, reason: 'not_configured' } };

  const provider = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    supportsStructuredOutputs: true,
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://mccourt.vercel.app',
      'X-Title': 'McCourt',
    },
  });

  const facts = {
    caseNumber: verdict.caseNumber,
    party: participants.map((p) => ({ id: p.id, name: p.name, budget: p.budget, request: p.request, goal: p.goal, hunger: p.hunger })),
    recommendations: recommendations.map((r) => ({
      participantId: r.participantId,
      participantName: participants.find((p) => p.id === r.participantId)?.name,
      items: r.items.map(({ id, name, price, calories, protein, source }) => ({ id, name, price, calories, protein, source })),
      totalPrice: r.totalPrice,
      totalCalories: r.calories,
      totalProtein: r.protein,
      constraints: r.constraints,
      reason: r.reason,
    })),
  };

  try {
    const { output } = await generateText({
      model: provider.chatModel(OPENROUTER_MODEL),
      output: Output.object({ schema: JudgeCopySchema }),
      abortSignal: AbortSignal.timeout(20000),
      maxOutputTokens: 1200,
      maxRetries: 0,
      providerOptions: { openrouter: { reasoning: { enabled: false } } },
      system: '你是麦门人民法院的大法官。只负责把已验证事实写成简短、幽默、克制的中文判词。不得创造餐品名称、价格、营养值、优惠或来源。不得改变组合、总价或推荐结果；营养总量为空时不得猜测。',
      prompt: `根据以下已验证事实生成简短判词文案。reasons 数组中每人一项，participantId 必须与输入一致。\n${JSON.stringify(facts, null, 2)}`,
    });
    if (!output) throw new Error('No judge output');
    return { verdict: mergeJudgeCopy(verdict, output, recommendations), judge: { engine: 'openrouter', model: OPENROUTER_MODEL } };
  } catch (error) {
    const failure = error as { name?: string; statusCode?: number; message?: string; responseBody?: string };
    const key = process.env.OPENROUTER_API_KEY?.trim();
    let providerMessage = failure.message || 'Unknown failure';
    try {
      const detail = JSON.parse(failure.responseBody || '{}').error;
      providerMessage = detail?.metadata?.raw || detail?.message || providerMessage;
    } catch { /* Keep the generic SDK diagnostic for non-JSON failures. */ }
    const diagnostic = String(providerMessage).replaceAll(key || 'no-key-placeholder', '[REDACTED]').slice(0, 500);
    console.warn('McCourt judge generation failed; using rules', { name: failure.name, status: failure.statusCode, diagnostic });
    return { verdict, judge: { engine: 'rules', model: null, reason: 'generation_failed' } };
  }
}

function mergeJudgeCopy(verdict: Verdict, copy: JudgeCopy, recommendations: Recommendation[]): Verdict {
  const reasons = new Map(copy.reasons.map((entry) => [entry.participantId, entry.reason]));
  return {
    ...verdict,
    caseName: copy.caseName,
    opening: copy.opening,
    opinions: copy.opinions,
    ruling: copy.ruling,
    recommendations: recommendations.map((recommendation) => ({
      ...recommendation,
      reason: reasons.get(recommendation.participantId) || recommendation.reason,
    })),
  };
}
