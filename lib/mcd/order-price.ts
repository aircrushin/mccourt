export type PriceQuote = {
  price: number;
  originalPrice: number | null;
  discount: number | null;
  items: Array<{ productCode: string; name: string; quantity: number; subtotal: number | null }>;
  takeWays: Array<{ code: string; title: string; subtitle: string | null }>;
};

export type CreatedOrder = { orderId: string; payH5Url: string; pickupCode: string | null };

const yuan = (fen: number) => Math.round(fen) / 100;

export function parsePriceQuote(data: any): PriceQuote {
  if (typeof data?.price !== 'number' || !Number.isFinite(data.price)) throw new Error('暂时无法核实应付金额。');
  const takeWays = (Array.isArray(data.takeWayList) ? data.takeWayList : []).flatMap((way: any) => (
    typeof way?.code === 'string' && way.code && typeof way?.title === 'string' && way.title
      ? [{ code: way.code, title: way.title, subtitle: typeof way.subtitle === 'string' && way.subtitle ? way.subtitle : null }]
      : []
  ));
  if (!takeWays.length) throw new Error('暂时无法确认取餐方式。');
  const items = (Array.isArray(data.productList) ? data.productList : []).flatMap((item: any) => {
    if (typeof item?.productCode !== 'string' || !item.productCode) return [];
    return [{
      productCode: item.productCode,
      name: typeof item.productName === 'string' && item.productName ? item.productName : item.productCode,
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      subtotal: typeof item.subtotal === 'number' ? yuan(item.subtotal) : null,
    }];
  });
  return {
    price: yuan(data.price),
    originalPrice: typeof data.originalPrice === 'number' ? yuan(data.originalPrice) : null,
    discount: typeof data.discount === 'number' ? yuan(data.discount) : null,
    items,
    takeWays,
  };
}

export function parseCreatedOrder(data: any): CreatedOrder {
  const orderId = typeof data?.orderId === 'string' ? data.orderId : '';
  const payH5Url = typeof data?.payH5Url === 'string' ? data.payH5Url : '';
  if (!orderId || !payH5Url.startsWith('https://')) throw new Error('订单已创建但没有可用的支付链接。');
  const pickupCode = data?.orderDetail?.pickupCode;
  return { orderId, payH5Url, pickupCode: typeof pickupCode === 'string' && pickupCode ? pickupCode : null };
}
