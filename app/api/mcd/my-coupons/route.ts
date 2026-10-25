import { NextResponse } from 'next/server';
import { fetchMyCoupons } from '@/lib/mcd/adapter';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const page = new URL(request.url).searchParams.get('page') ?? '1';
  if (!/^[1-5]$/.test(page)) {
    return NextResponse.json({ error: '页码须为 1 至 5。' }, { status: 400, headers });
  }
  if (!process.env.MCD_MCP_TOKEN?.trim()) {
    return NextResponse.json({ error: '当前尚未绑定麦当劳账户，暂时无法查看优惠券。' }, { status: 503, headers });
  }
  try {
    return NextResponse.json(await fetchMyCoupons(Number(page)), { headers });
  } catch {
    return NextResponse.json({ error: '暂时无法获取优惠券，请稍后重试。' }, { status: 502, headers });
  }
}
