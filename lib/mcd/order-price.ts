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

type JsonRpcMessage = { jsonrpc?: string; id?: number; result?: any; error?: { code: number; message: string } };

export function parseMcpRpc(text: string): JsonRpcMessage {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  let chosen: JsonRpcMessage | null = null;
  for (const event of trimmed.split(/\n\n+/)) {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n').trim();
    if (!data || data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data) as JsonRpcMessage;
      if (parsed && typeof parsed === 'object' && ('result' in parsed || 'error' in parsed)) chosen = parsed;
      else if (!chosen) chosen = parsed;
    } catch { /* A later event may still contain the complete JSON-RPC message. */ }
  }
  if (!chosen) throw new Error('MCP returned an unreadable response');
  return chosen;
}

function refused(payload: any) {
  return !!payload && typeof payload === 'object' && (payload.success === false || (payload.code != null && Number(payload.code) !== 200 && payload.success !== true));
}

export function readToolData(result: any): any {
  if (result?.isError) {
    const text = (result?.content ?? []).map((block: any) => block?.text ?? '').join('\n').trim();
    throw new Error(text || '暂时无法完成点餐，请稍后重试。');
  }
  const structured = result?.structuredContent ?? result;
  const embedded = embeddedPayload(result);
  const payload = structured && typeof structured === 'object' && ('success' in structured || 'code' in structured || 'data' in structured) ? structured : embedded;
  if (refused(payload)) throw new Error(typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : '暂时无法完成点餐，请稍后重试。');
  if (payload?.data != null) return payload.data;
  return null;
}

function embeddedPayload(result: any): any | null {
  const text = (result?.content ?? []).map((block: any) => block?.text ?? '').join('\n');
  const start = text.indexOf('{"success"');
  if (start < 0) return null;
  for (let end = text.lastIndexOf('}'); end > start; end--) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* Keep shrinking until the embedded object parses. */ }
  }
  return null;
}

export function selectionsFromMealDetail(detail: any) {
  const roundList = (Array.isArray(detail?.rounds) ? detail.rounds : []).flatMap((round: any) => {
    if (round?.id == null) return [];
    const comboItemList = (Array.isArray(round.choices) ? round.choices : []).flatMap((choice: any) => (
      choice?.isDefault === 1 && choice.code ? [{ code: String(choice.code), quantity: typeof choice.quantity === 'number' && choice.quantity > 0 ? choice.quantity : 1 }] : []
    ));
    return comboItemList.length ? [{ round: String(round.id), comboItemList }] : [];
  });
  const values = (Array.isArray(detail?.modification?.items) ? detail.modification.items : []).flatMap((item: any) => (
    Array.isArray(item?.values) ? item.values : []
  )).flatMap((value: any) => {
    if (!value?.code) return [];
    const selectedQuantity = typeof value.selectedQuantity === 'number' ? value.selectedQuantity : 0;
    if (selectedQuantity > 0 && value.selectedKey) return [{ code: String(value.code), key: String(value.selectedKey), quantity: selectedQuantity }];
    if (typeof value.unselectedKey === 'string' && value.unselectedKey) return [{ code: String(value.code), key: value.unselectedKey, quantity: 0 }];
    return [];
  });
  return {
    ...(roundList.length ? { roundList } : {}),
    ...(values.length ? { modification: { values } } : {}),
  };
}
