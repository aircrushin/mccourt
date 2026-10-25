'use client';

import { useRef, useState } from 'react';
import type { MealCoupon } from '@/lib/mcd/coupons';

export function CouponButton({ coupon }: { coupon: MealCoupon }) {
  const [claimed, setClaimed] = useState(coupon.status === 'claimed');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  async function claim() {
    if (pending.current || claimed) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/mcd/coupons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ couponName: coupon.name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '领取失败，请稍后重试。');
      setClaimed(data.claimed === true);
      setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : '领取失败，请稍后重试。'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="meal-coupon">
    <small>相关优惠券 · {coupon.name}</small>
    {claimed ? <small>已领取 · 使用条件以麦当劳券包为准</small> : <button type="button" className="chip" disabled={busy} onClick={claim}>{busy ? '正在领券…' : '领券（同时领取全部可领券）'}</button>}
    {message && <small role="status">{message}</small>}
    <small>优惠未计入组合总价，适用门店、时段及最终价格以麦当劳为准。</small>
  </div>;
}
