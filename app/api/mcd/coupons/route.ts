import { NextResponse } from 'next/server';
import { z } from 'zod';
import { claimCoupons } from '@/lib/mcd/adapter';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    const url = new URL(request.url);
    // A reverse proxy may expose a different host/protocol than the internal URL.
    const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || url.host;
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.slice(0, -1);
    let sameOrigin = false;
    try {
      sameOrigin = ['http', 'https'].includes(protocol) && origin === new URL(`${protocol}://${host}`).origin;
    } catch { /* Malformed proxy headers must not bypass the origin check. */ }
    if (!sameOrigin) return NextResponse.json({ error: '请求来源不正确' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = z.object({ couponName: z.string().trim().min(1).max(200) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '领券请求格式不正确' }, { status: 400 });
  try { return NextResponse.json(await claimCoupons(parsed.data.couponName)); }
  catch { return NextResponse.json({ error: '暂时无法确认领券结果，请稍后重试或到麦当劳查看。' }, { status: 502 }); }
}
