import { demoMeals } from '@/lib/court/demo-meals';
import { NextResponse } from 'next/server';
import { RecommendRequestSchema } from '@/lib/types/index';
import { fetchMeals } from '@/lib/mcd/adapter';
import { recommend } from '@/lib/court/recommend';
import { buildVerdict } from '@/lib/court/judge';
import { permitFromRecommendations, signOrderPermit } from '@/lib/court/order-permit';
import { enrichVerdictWithOpenRouter } from '@/lib/ai/judge';

export async function POST(request: Request) {
  try {
    const parsed = RecommendRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error:'请求格式不正确', details:parsed.error.flatten() }, { status:400 });
    const input = parsed.data;
    const mcp = input.mode === 'demo' ? { meals:demoMeals, live:false, warning:'体验资料：以下餐品、价格与营养来自固定案例资料，未调用实时服务。', updatedAt:null, store:null } : await fetchMeals(input.location ?? {});
    const recommendations = recommend(input.participants, mcp.meals);
    const baseVerdict = buildVerdict(input.partyName, input.participants, recommendations, mcp.live && mcp.meals.length > 0, mcp.updatedAt, mcp.warning);
    let orderPermit = null;
    if (baseVerdict.live && mcp.store) {
      try { orderPermit = signOrderPermit(permitFromRecommendations(mcp.store, recommendations)); }
      catch { orderPermit = null; }
    }
    const { verdict, judge } = await enrichVerdictWithOpenRouter({ ...baseVerdict, store: mcp.store, orderPermit }, input.participants, recommendations);
    return NextResponse.json({ verdict, toolName:mcp.toolName ?? null, mealCount:mcp.meals.length, judgeModel:judge.model, judge });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : '服务暂时不可用' }, { status:500 }); }
}
