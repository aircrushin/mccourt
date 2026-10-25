import { z } from 'zod';
import { toolPayload } from './coupons';

const text = z.string().nullish();
const walletSchema = z.object({
  coupons: z.array(z.object({
    title: z.string().min(1), subtitle: text, image: text, bigImage: text,
    datetimeText: text, tradeStartDate: text, tradeEndDate: text, receivedDaysMsg: text,
    enable: z.number().nullish(),
    tags: z.array(z.object({ label: text })).nullish(),
    discountInfo: z.object({ discountValue: text, discountDesc: text, discountTypeText: text }).nullish(),
    currentChannelCanRedeem: z.boolean().nullish(),
    onlyAppCanRedeem: z.boolean().nullish(), onlyPosCanRedeem: z.boolean().nullish(), toastText: text,
  })),
  currentPage: z.number().int().min(1).max(5), pageSize: z.number().int().min(1).max(200),
  totalCount: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative(),
});

function imageUrl(value: string | null | undefined) {
  if (!value) return null;
  try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
}

export function parseMyCoupons(result: unknown) {
  const payload = toolPayload(result);
  if (payload?.success === false || (payload?.code != null && Number(payload.code) !== 200)) {
    throw new Error('优惠券查询失败，请稍后重试。');
  }
  const parsed = walletSchema.safeParse(payload?.data);
  if (!parsed.success) throw new Error('暂时无法读取券包资料，请稍后重试。');
  const { coupons, ...pagination } = parsed.data;
  return {
    ...pagination,
    coupons: coupons.map(coupon => ({
      title: coupon.title, subtitle: coupon.subtitle || null,
      image: imageUrl(coupon.image) ?? imageUrl(coupon.bigImage),
      validity: coupon.datetimeText || (coupon.tradeStartDate && coupon.tradeEndDate
        ? `${coupon.tradeStartDate} 至 ${coupon.tradeEndDate}` : null),
      received: coupon.receivedDaysMsg || null,
      enable: coupon.enable === 1 ? true : coupon.enable === 0 ? false : null,
      tags: (coupon.tags ?? []).flatMap(tag => tag.label ? [tag.label] : []),
      discount: coupon.discountInfo?.discountValue ? {
        value: coupon.discountInfo.discountValue,
        description: coupon.discountInfo.discountDesc || null,
        symbol: coupon.discountInfo.discountTypeText || '',
      } : null,
      restrictions: [...new Set([
        coupon.toastText,
        coupon.onlyAppCanRedeem ? '仅限麦当劳 App 使用' : null,
        coupon.onlyPosCanRedeem ? '仅限门店柜台使用' : null,
        coupon.currentChannelCanRedeem === false ? '当前渠道不可直接核销，请按券面要求使用' : null,
      ].filter((value): value is string => !!value))],
    })),
  };
}

export type MyCouponWallet = ReturnType<typeof parseMyCoupons>;
