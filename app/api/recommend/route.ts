import { NextResponse } from 'next/server';
import { RecommendRequestSchema } from '@/lib/types/index';
import { fetchMeals } from '@/lib/mcd/adapter';
import { recommend } from '@/lib/court/recommend';
import { buildVerdict } from '@/lib/court/judge';

const demoMeals = [
  { id:'demo-burger', name:'经典牛肉汉堡（演示）', price:18, calories:420, protein:20, tags:['肉','饱腹'], source:'演示数据' },
  { id:'demo-chicken', name:'香辣鸡腿堡（演示）', price:22, calories:510, protein:25, tags:['鸡肉','蛋白质'], source:'演示数据' },
  { id:'demo-fries', name:'薯条（演示）', price:12, calories:320, protein:4, tags:['薯条','快乐'], source:'演示数据' },
  { id:'demo-salad', name:'清爽沙拉（演示）', price:16, calories:210, protein:8, tags:['低卡','控制热量'], source:'演示数据' },
];

export async function POST(request: Request) {
  try {
    const parsed = RecommendRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error:'请求格式不正确', details:parsed.error.flatten() }, { status:400 });
    const input = parsed.data;
    const mcp = input.mode === 'demo' ? { meals:demoMeals, live:false, warning:'演示模式：以下餐品、价格与营养均为演示数据，不代表实时信息。', updatedAt:null } : await fetchMeals();
    const recommendations = recommend(input.participants, mcp.meals);
    const verdict = buildVerdict(input.partyName, input.participants, recommendations, mcp.live && mcp.meals.length > 0, mcp.updatedAt, mcp.warning);
    return NextResponse.json({ verdict, toolName:mcp.toolName ?? null, mealCount:mcp.meals.length });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : '服务暂时不可用' }, { status:500 }); }
}
