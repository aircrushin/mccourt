'use client';

import { useState } from 'react';
import { formatDistance } from '@/lib/mcd/stores';
import type { OrderPermitToken } from '@/lib/types/index';
import { money } from './combination';

type Quote = {
  price: number;
  originalPrice: number | null;
  discount: number | null;
  items: Array<{ productCode: string; name: string; quantity: number; subtotal: number | null }>;
  takeWays: Array<{ code: string; title: string; subtitle: string | null }>;
  store: { storeName: string; address: string; distance: number | null };
};
type PlacedOrder = { orderId: string; payH5Url: string; pickupCode: string | null };
type Selection = { participantId: string; itemIds: string[] };

export function OrderPanel({ permit, selections }: { permit: OrderPermitToken; selections: Selection[] }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [takeWay, setTakeWay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  const requestOrder = async (takeWayCode?: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/mcd/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...permit, selections, ...(takeWayCode ? { takeWayCode } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '暂时无法完成点餐，请稍后重试。');
      if (data.order?.payH5Url) {
        setOrder(data.order);
        return;
      }
      if (!data.quote) throw new Error('暂时无法完成点餐，请稍后重试。');
      setQuote(data.quote);
      setTakeWay(data.quote.takeWays.length === 1 ? data.quote.takeWays[0].code : '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暂时无法完成点餐，请稍后重试。');
    } finally { setBusy(false); }
  };

  if (order) return <section className="order-panel" aria-label="支付订单">
    <h2>订单已创建</h2>
    <p className="case-no">订单号 {order.orderId}</p>
    {order.pickupCode && <p className="verdict-copy">取餐码 {order.pickupCode}</p>}
    <a className="cta" href={order.payH5Url}>前往支付</a>
    <p className="source-note">未完成支付的订单会保留为待支付。这笔订单记在当前接入的麦当劳账号上。</p>
  </section>;

  return <section className="order-panel" aria-label="去支付这份判决">
    {!quote && <button className="cta yellow" type="button" disabled={busy} onClick={() => requestOrder()}>{busy ? '正在按最近门店计价…' : '去支付这份判决'}</button>}
    {quote && <>
      <h2>确认后前往支付</h2>
      <p className="verdict-copy">{quote.store.storeName}{quote.store.address ? ` · ${quote.store.address}` : ''}{formatDistance(quote.store.distance) ? ` · ${formatDistance(quote.store.distance)}` : ''}</p>
      <ul className="receipt-items">{quote.items.map(item => <li key={item.productCode}><div><strong>{item.name}</strong><small>× {item.quantity}</small></div><span className="item-price">{item.subtotal != null ? money(item.subtotal) : ''}</span></li>)}</ul>
      <div className="combo-total"><span>应付</span><strong>{money(quote.price)}</strong></div>
      {quote.discount ? <p className="source-note">麦当劳计价已计入优惠 {money(quote.discount)}。</p> : <p className="source-note">应付金额来自麦当劳实时计价。</p>}
      <div className="take-ways" role="group" aria-label="取餐方式">{quote.takeWays.map(way => <button key={way.code} type="button" className={`chip ${takeWay === way.code ? 'selected' : ''}`} onClick={() => setTakeWay(way.code)}>{way.title}{way.subtitle ? ` · ${way.subtitle}` : ''}</button>)}</div>
      <button className="cta" type="button" disabled={busy || !takeWay} onClick={() => requestOrder(takeWay)}>{busy ? '正在创建订单…' : '确认下单'}</button>
      <p className="source-note">这笔到店订单记在当前接入的麦当劳账号上。确认后打开支付页。未完成支付的订单会保留为待支付。</p>
    </>}
    {error && <p className="notice" role="status">{error}</p>}
  </section>;
}
