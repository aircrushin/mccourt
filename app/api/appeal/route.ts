import { NextResponse } from 'next/server';
import { ParticipantSchema } from '@/lib/types/index';
import { fetchMeals } from '@/lib/mcd/adapter';
import { recommend } from '@/lib/court/recommend';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const participant = ParticipantSchema.parse({ ...body.participant, request: body.reason || body.participant?.request });
    const mcp = body.mode === 'demo' ? { meals: [
      { id:'demo-burger', name:'经典牛肉汉堡（体验案例）', price:18, calories:420, protein:20, tags:['肉','饱腹'], source:'体验案例资料' },
      { id:'demo-chicken', name:'香辣鸡腿堡（体验案例）', price:22, calories:510, protein:25, tags:['鸡肉','蛋白质'], source:'体验案例资料' },
      { id:'demo-fries', name:'薯条（体验案例）', price:12, calories:320, protein:4, tags:['薯条','快乐'], source:'体验案例资料' },
      { id:'demo-salad', name:'清爽沙拉（体验案例）', price:16, calories:210, protein:8, tags:['低卡','控制热量'], source:'体验案例资料' },
    ], live:false } : await fetchMeals();
    const [result] = recommend([participant], mcp.meals);
    return NextResponse.json({ recommendation:result, live:mcp.live, warning:'warning' in mcp ? (mcp.warning ?? null) : null });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : '上诉处理失败' }, { status:500 }); }
}
