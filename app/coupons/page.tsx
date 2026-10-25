'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw, Ticket } from 'lucide-react';
import type { MyCouponWallet } from '@/lib/mcd/my-coupons';

type Wallet = MyCouponWallet & { updatedAt: string };

function CouponImage({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="wallet-image">{src && !failed
    ? <Image src={src} alt={`${title}券面`} width={160} height={160} unoptimized onError={() => setFailed(true)} />
    : <span><Ticket size={28} aria-hidden="true" />暂无券面</span>}</div>;
}

export default function CouponsPage() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/mcd/my-coupons?page=${page}`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '暂时无法获取优惠券，请稍后重试。');
        if (!controller.signal.aborted) setWallet(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '暂时无法获取优惠券，请稍后重试。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, revision]);

  const reload = (nextPage = page) => {
    setLoading(true);
    setError('');
    setWallet(null);
    setPage(nextPage);
    setRevision(value => value + 1);
  };

  return <div className="app-shell"><div className="grain" /><div className="shell">
    <header className="masthead"><Link className="brand" href="/"><span className="brand-mark">M</span><span>McCourt</span></Link><span className="pill">当前绑定账户</span></header>
    <main className="paper wallet-page">
      <Link className="text-btn" href="/"><ArrowLeft size={15} aria-hidden="true" />返回大厅</Link>
      <p className="page-kicker">COUPON WALLET / 省钱证据</p>
      <h1 className="page-title">我的优惠券</h1>
      <p className="verdict-copy">这里展示当前绑定的麦当劳账户券包，所有访客看到同一账户的券。</p>
      <div className="notice">券包中的券不保证适用于当前门店或订单。请留意使用时段、取餐方式及渠道限制，具体以麦当劳结算结果为准。</div>
      <div className="wallet-toolbar"><p role="status" aria-live="polite">{loading ? '正在调取券包…' : wallet ? `共 ${wallet.totalCount} 张券` : '券包暂未获取'}</p><button className="text-btn" disabled={loading} onClick={() => reload()}><RotateCw size={14} aria-hidden="true" />刷新券包</button></div>
      {loading && <div className="wallet-loading" aria-hidden="true"><Ticket size={30} /><p>正在向麦当劳调取优惠券资料</p></div>}
      {error && <div role="alert"><p className="verdict-copy">{error}</p><button className="chip" onClick={() => reload()}>重新获取</button></div>}
      {wallet && <>
        {wallet.coupons.length === 0 ? <div className="wallet-empty"><Ticket size={32} aria-hidden="true" /><h2>这一页还没有优惠券</h2><p>可以前往麦当劳 App 查看或领取优惠券，再回来刷新券包。</p></div>
          : <div className="wallet-list">{wallet.coupons.map((coupon, index) => <article className="wallet-coupon" key={`${page}-${revision}-${index}`} aria-label={coupon.title}>
            <div className="wallet-coupon-top"><CouponImage src={coupon.image} title={coupon.title} /><div className="wallet-coupon-title"><h2>{coupon.title}</h2>{coupon.subtitle && <p>{coupon.subtitle}</p>}{coupon.discount && <p className="wallet-discount"><strong>{coupon.discount.symbol}{coupon.discount.value}</strong>{coupon.discount.description && <span>{coupon.discount.description}</span>}</p>}<div className="reco-meta">{coupon.tags.map((tag, i) => <span className="meta" key={i}>{tag}</span>)}{coupon.enable === false && <span className="meta">当前不可用</span>}</div></div></div>
            <p className="wallet-validity">有效期与时段：{coupon.validity || '暂未获取，请到麦当劳 App 查看'}</p>
            {coupon.restrictions.length > 0 && <ul className="wallet-restrictions" aria-label="使用限制">{coupon.restrictions.map((restriction, i) => <li key={i}>{restriction}</li>)}</ul>}
            {coupon.received && <p className="source-note">{coupon.received}</p>}
          </article>)}</div>}
        {wallet.totalPages > 1 && <nav className="wallet-pagination" aria-label="优惠券分页"><button className="chip" disabled={page <= 1} onClick={() => reload(page - 1)}><ChevronLeft size={14} aria-hidden="true" />上一页</button><span>第 {wallet.currentPage}/{Math.min(wallet.totalPages, 5)} 页</span><button className="chip" disabled={page >= Math.min(wallet.totalPages, 5)} onClick={() => reload(page + 1)}>下一页<ChevronRight size={14} aria-hidden="true" /></button></nav>}
        {wallet.totalPages > 5 && <p className="source-note">当前最多可查看前 5 页，更多优惠券请前往麦当劳 App 查看。</p>}
        <p className="source-note wallet-source">来源：麦当劳 MCP · 更新于 {new Date(wallet.updatedAt).toLocaleString('zh-CN')}</p>
      </>}
    </main>
  </div></div>;
}
