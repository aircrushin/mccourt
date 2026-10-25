export type MealCoupon = { name: string; status: 'available' | 'claimed' };

export function toolPayload(result: any): any {
  if (result?.isError) throw new Error('优惠券服务返回错误，请稍后重试。');
  if (result?.structuredContent) return result.structuredContent;
  for (const block of result?.content ?? []) {
    if (typeof block.text !== 'string') continue;
    try { return JSON.parse(block.text); } catch { /* Some official tools return Markdown. */ }
    const start = block.text.indexOf('{');
    const end = block.text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(block.text.slice(start, end + 1)); } catch { /* Plain Markdown below. */ }
    }
  }
  return null;
}

export function parseCoupons(result: any): MealCoupon[] {
  const payload = toolPayload(result);
  if (payload?.code != null && payload.code !== 200) throw new Error('优惠券查询失败，请稍后重试。');
  if (payload?.success === false) throw new Error('优惠券查询失败，请稍后重试。');
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data.flatMap<MealCoupon>(row => {
    const name = row.couponName;
    const status = `${row.couponStatus ?? ''} ${row.label ?? ''}`;
    if (typeof name !== 'string') return [];
    if (/已领取/.test(status)) return [{ name, status: 'claimed' as const }];
    return /可领取|待领取/.test(status) ? [{ name, status: 'available' as const }] : [];
  });
  const text = (result?.content ?? []).map((block: any) => block.text ?? '').join('\n');
  return [...text.matchAll(/优惠券标题：([^\n]+)[\s\S]*?状态：([^\n]+)/g)].flatMap<MealCoupon>(match => {
    const name = match[1].replace(/\\\s*$/, '').trim();
    return /已领取/.test(match[2]) ? [{ name, status: 'claimed' as const }]
      : /可领取/.test(match[2]) ? [{ name, status: 'available' as const }] : [];
  });
}

// Match an individual product only; a bundle mentioning it is not an applicable single-item coupon.
export function couponsForMeal(name: string, coupons: MealCoupon[]) {
  const normalize = (value: string) => value.replace(/\s/g, '').replace(/^[¥￥]?\d+(?:\.\d+)?元/, '').replace(/^免费/, '');
  return coupons.filter(coupon => normalize(coupon.name) === normalize(name));
}
