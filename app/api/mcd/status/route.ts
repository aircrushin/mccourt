import { NextResponse } from 'next/server';
import { discoverMcpTools } from '@/lib/mcd/adapter';
export async function GET() { try { const result = await discoverMcpTools(); return NextResponse.json({ live:result.live, toolCount:result.tools.length, tools:result.tools.map((t:any)=>({name:t.name,description:t.description})), reason:(result as any).reason ?? null }); } catch (e) { return NextResponse.json({ live:false, toolCount:0, tools:[], reason:e instanceof Error?e.message:'MCP 状态未知' }, { status:502 }); } }
