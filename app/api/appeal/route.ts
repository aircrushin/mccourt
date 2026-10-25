import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ParticipantSchema } from '@/lib/types/index';
import { fetchMeals } from '@/lib/mcd/adapter';
import { combinationKey, foodUnits, recommend } from '@/lib/court/recommend';
import { readOrderPermit, refreshPermit, signOrderPermit } from '@/lib/court/order-permit';
import { demoMeals } from '@/lib/court/demo-meals';

const AppealSchema = z.object({
  participant: ParticipantSchema,
  reason: z.string().trim().min(1).max(180),
  previousItemIds: z.array(z.string()).max(6).default([]),
  mode: z.enum(['live', 'demo']).default('live'),
  storeCode: z.string().trim().min(1).max(40).optional(),
  orderPermit: z.object({ payload: z.string().min(1).max(12000), signature: z.string().min(1).max(200) }).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = AppealSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: '上诉请求格式不正确' }, { status: 400 });
    const { participant, reason, previousItemIds, mode, storeCode, orderPermit } = parsed.data;
    const mcp = mode === 'demo' ? { meals: demoMeals, live: false, warning: '体验资料，不代表实时价格。', updatedAt: null, store: null } : await fetchMeals(storeCode ? { storeCode } : {});
    const previous = previousItemIds.map(id => mcp.meals.find(m => m.id === id)).filter(m => m != null);
    const verifiedPrevious = previous.length > 0 && previous.length === previousItemIds.length;
    const previousTotal = verifiedPrevious && previous.every(m => m.price != null) ? previous.reduce((sum, m) => sum + m.price!, 0) : null;
    const [recommendation] = recommend([{
      ...participant,
      hunger: /不够饱/.test(reason) ? Math.min(5, participant.hunger + 1) : participant.hunger,
      request: `${participant.request}；上诉：${reason}`,
    }], mcp.meals, {
      excludeCombination: verifiedPrevious ? [combinationKey(previous)] : [],
      maxTotalExclusive: /太贵/.test(reason) && previousTotal != null ? previousTotal : undefined,
      minFoodUnitsExclusive: /不够饱/.test(reason) && verifiedPrevious ? foodUnits(previous) : undefined,
    });
    let nextPermit = null;
    if (orderPermit) {
      try { nextPermit = signOrderPermit(refreshPermit(readOrderPermit(orderPermit.payload, orderPermit.signature), participant.id, recommendation)); }
      catch { nextPermit = null; }
    }
    return NextResponse.json({ recommendation, live: mcp.live, updatedAt: 'updatedAt' in mcp ? mcp.updatedAt : null,
      warning: mcp.warning ?? null, orderPermit: nextPermit,
      message: recommendation.items.length ? null : `${recommendation.reason} 原方案已保留，尚未满足的新诉求未被自动替换。`,
    });
  } catch { return NextResponse.json({ error: '上诉处理失败，请稍后重试。' }, { status: 500 }); }
}
