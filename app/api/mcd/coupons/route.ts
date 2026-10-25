import { NextResponse } from 'next/server';
import { z } from 'zod';
import { claimCoupons } from '@/lib/mcd/adapter';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: '请求来源不正确' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ couponName: z.string().trim().min(1).max(200) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '领券请求格式不正确' }, { status: 400 });
  try { return NextResponse.json(await claimCoupons(parsed.data.couponName)); }
  catch { return NextResponse.json({ error: '暂时无法确认领券结果，请稍后重试或到麦当劳查看。' }, { status: 502 }); }
}
