import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placePickupOrder, quotePickup } from '@/lib/mcd/adapter';
import { readOrderPermit, resolveSelection } from '@/lib/court/order-permit';

const OrderSchema = z.object({
  payload: z.string().min(1).max(12000),
  signature: z.string().min(1).max(200),
  selections: z.array(z.object({
    participantId: z.string().min(1).max(80),
    itemIds: z.array(z.string().min(1).max(80)).min(1).max(6),
  })).min(1).max(4),
  takeWayCode: z.string().trim().min(1).max(40).optional(),
});

const SAFE_ERRORS = [
  '判决已失效，请重新开庭。',
  '判决已过期，请重新开庭。',
  '请确认每一位当事人的餐品后再下单。',
  '所选餐品不在本场判决中。',
  '官方套餐暂不能直接下单。',
  '请选择列出的取餐方式。',
  '暂时无法核实应付金额。',
  '暂时无法确认取餐方式。',
  '订单已创建但没有可用的支付链接。',
  '下单签名未配置。',
  '暂时无法向麦当劳确认价格。',
  '暂时无法创建订单。',
];

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || url.host;
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.slice(0, -1);
  try { return ['http', 'https'].includes(protocol) && origin === new URL(`${protocol}://${host}`).origin; }
  catch { return false; }
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return SAFE_ERRORS.find(item => message.includes(item)) ?? '暂时无法完成点餐，请稍后重试。';
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: '请求来源不正确' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '点餐请求格式不正确' }, { status: 400 });
  try {
    const permit = readOrderPermit(parsed.data.payload, parsed.data.signature);
    const items = resolveSelection(permit, parsed.data.selections).map(({ productCode, quantity }) => ({ productCode, quantity }));
    const quote = await quotePickup(permit.storeCode, items);
    if (!parsed.data.takeWayCode) {
      return NextResponse.json({ quote: { ...quote, store: { storeName: permit.storeName, address: permit.address, distance: permit.distance } } });
    }
    if (!quote.takeWays.some(way => way.code === parsed.data.takeWayCode)) {
      return NextResponse.json({ error: '请选择列出的取餐方式。' }, { status: 400 });
    }
    const order = await placePickupOrder(permit.storeCode, items, parsed.data.takeWayCode);
    return NextResponse.json({ order });
  } catch (error) {
    const message = publicError(error);
    const status = /判决|餐品|套餐|取餐方式|签名/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
