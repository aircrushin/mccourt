'use client';

import { useState } from 'react';
import { Check, Gavel, RotateCcw, Share2 } from 'lucide-react';
import type { MealCombination, Participant, Verdict } from '@/lib/types/index';
import { Combination, money } from './combination';

const APPEALS = ['太贵了', '不够饱', '不喜欢', '想换个口味'];
export function VerdictPage({ verdict, participants, mode, onReset }: { verdict: Verdict; participants: Participant[]; mode: 'live' | 'demo'; onReset: () => void }) {
  const [recs, setRecs] = useState(verdict.recommendations);
  const [rounds, setRounds] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [appealing, setAppealing] = useState<string | null>(null);
  const [customReasons, setCustomReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<Record<string, string | null>>({});
  const [final, setFinal] = useState(false);
  const [changed, setChanged] = useState(false);
  const currentRuling = changed ? '本庭已按当事人的选择或上诉重新调整组合。各人的预算红线继续有效，最终餐品与总价以以下清单为准。' : verdict.ruling;
  const allConfirmed = participants.every(p => confirmed.includes(p.id));
  const total = recs.every(r => r.items.length && r.totalPrice != null) ? recs.reduce((sum, r) => sum + Math.round(r.totalPrice! * 100), 0) / 100 : null;
  const share = async () => {
    const text = `${verdict.caseName}\n${currentRuling}\n` + recs.map(r => `${participants.find(p => p.id === r.participantId)?.name}: ${r.items.map(item => item.name).join(' + ') || '暂未匹配'}，合计 ${r.totalPrice != null ? money(r.totalPrice) : '暂未获取'}`).join('\n');
    try { if (navigator.share) await navigator.share({ title: '麦门法庭判决书', text }); else await navigator.clipboard?.writeText(text); }
    catch { /* Cancelling the native share sheet leaves the verdict intact. */ }
  };
  const choose = (id: string, combo: MealCombination) => {
    setChanged(true);
    setRecs(current => current.map(r => r.participantId === id ? { ...combo, participantId: id, alternatives: [{ items: r.items, totalPrice: r.totalPrice, calories: r.calories, protein: r.protein, score: r.score, reason: r.reason, constraints: r.constraints }, ...r.alternatives.filter(a => a !== combo)].slice(0, 2) } : r));
    setMessages(current => ({ ...current, [id]: '已采用备选组合，请查看更新后的餐品与总价。' }));
  };
  const appeal = async (p: Participant, reason: string) => {
    if ((rounds[p.id] ?? 0) >= 3 || busy) return;
    setBusy(p.id);
    const current = recs.find(r => r.participantId === p.id);
    try {
      const res = await fetch('/api/appeal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ participant: p, reason, previousItemIds: current?.items.map(item => item.id) ?? [], mode }) });
      const data = await res.json();
      if (!res.ok || !data.recommendation) throw new Error(data.error || '上诉失败，请重试。');
      setRounds(current => ({ ...current, [p.id]: (current[p.id] ?? 0) + 1 }));
      if (data.recommendation.items.length) {
        setChanged(true);
        setRecs(current => current.map(r => r.participantId === p.id ? data.recommendation : r));
        setUpdatedAt(current => ({ ...current, [p.id]: data.updatedAt }));
      }
      setMessages(current => ({ ...current, [p.id]: data.message || `上诉已重新计算，请核对新组合。${data.warning || ''}` }));
      setAppealing(null);
    } catch (error) { setMessages(current => ({ ...current, [p.id]: error instanceof Error ? error.message : '上诉失败，请重试。' })); }
    finally { setBusy(null); }
  };
  return <main className="paper">
    <div className="verdict-header"><div><p className="case-no">{verdict.caseNumber} · {mode === 'live' ? 'LIVE' : 'SAMPLE'}</p><h1 className="verdict-title">麦门人民<br />法院判决书</h1></div><span className="stamp">{final ? <>判决<br />生效</> : <>审理<br />中</>}</span></div>
    <p className="case-no" style={{ marginTop: 16 }}>案由：{verdict.caseName}</p><p className="verdict-copy">{verdict.opening}</p>
    {verdict.warning && <div className="notice">{verdict.warning}</div>}
    <div className="ruling"><strong>本庭意见</strong><br />{currentRuling}<small className="source-note">以下为当前选定方案；更换备选或上诉后，以餐品清单与总价为准。</small></div>
    <div className="section-label"><h2>当事人推荐</h2><span>{recs.length} 份方案</span></div>
    <div className="reco-list">{participants.map(p => {
      const r = recs.find(x => x.participantId === p.id);
      const accepted = confirmed.includes(p.id);
      const timestamp = updatedAt[p.id] ?? verdict.sourceUpdatedAt;
      return <article className="reco-card" key={p.id} aria-label={`${p.name}的推荐组合`}>
        <div className="reco-top"><div><div className="case-no">当事人 {p.name}</div><h3 className="reco-name">{r?.items.length ? '本庭推荐组合' : '暂无可验证组合'}</h3></div><span className="pill">{accepted ? '已服判' : `${r?.items.length ?? 0} 项餐品`}</span></div>
        {r && r.items.length > 0 && <Combination combination={r} budget={p.budget} />}
        <p className="verdict-copy">{r?.reason}</p>
        {!!r?.constraints.length && <ul className="combo-limitations">{r.constraints.map(note => <li key={note}>{note}</li>)}</ul>}
        <p className="source-note">资料更新：{timestamp ? new Date(timestamp).toLocaleString('zh-CN') : '未获取更新时间'}</p>
        {!!r?.alternatives.length && <details className="alternatives"><summary>备选组合 · {r.alternatives.length} 个方案</summary>{r.alternatives.map((combo, index) => <div className="alternative" key={combo.items.map(item => item.id).join('|')}>
          <h4>备选 {index + 1}</h4><Combination combination={combo} budget={p.budget} compact /><p className="source-note">{combo.reason}</p>
          {!accepted && !final && <button className="chip" disabled={!!busy} onClick={() => choose(p.id, combo)}>采用此组合</button>}
        </div>)}</details>}
        {r && !r.alternatives.length && <p className="source-note">当前条件下暂无其他可验证的备选组合。</p>}
        {messages[p.id] && <p className="notice" role="status">{messages[p.id]}</p>}
        {!accepted && <div className="appeal-row"><button disabled={!!busy || !r?.items.length} onClick={() => setConfirmed(current => [...current, p.id])}><Check size={14} /> 服判</button><button disabled={!!busy || (rounds[p.id] ?? 0) >= 3} onClick={() => setAppealing(appealing === p.id ? null : p.id)}><RotateCcw size={14} /> 我要上诉 {rounds[p.id] ? `(${rounds[p.id]}/3)` : ''}</button></div>}
        {appealing === p.id && <div className="appeal-options" aria-label="选择上诉理由">{APPEALS.map(reason => <button key={reason} className="chip" disabled={!!busy} onClick={() => appeal(p, reason)}>{busy === p.id ? '正在重算…' : reason}</button>)}<form className="custom-appeal" onSubmit={event => { event.preventDefault(); const reason = customReasons[p.id]?.trim(); if (reason) appeal(p, reason); }}><label htmlFor={`appeal-${p.id}`}>自定义理由</label><input id={`appeal-${p.id}`} className="input" maxLength={180} value={customReasons[p.id] ?? ''} onChange={event => setCustomReasons(current => ({ ...current, [p.id]: event.target.value }))} placeholder="告诉法官哪里不满意" /><button className="chip" disabled={!!busy || !customReasons[p.id]?.trim()}>提交上诉</button></form></div>}
      </article>;
    })}</div>
    <div className="party-total"><span>全桌合计<small>每人分别遵守自己的预算</small></span><strong>{total != null ? money(total) : '暂无法核实'}</strong></div>
    {allConfirmed && !final && <button className="cta yellow" style={{ marginTop: 22 }} onClick={() => setFinal(true)}>判决生效 <Gavel size={21} /></button>}
    {final && <div className="final-banner">判决生效！各位当事人，开吃。</div>}
    <div className="two-col" style={{ marginTop: 14 }}><button className="chip" onClick={share}><Share2 size={14} /> 分享判决</button><button className="chip" onClick={onReset}><RotateCcw size={14} /> 重新开庭</button></div>
    <div className="notice">数据说明：{mode === 'live' ? '组合按麦当劳 MCP 返回的单品价格相加，不代表优惠套餐价。缺少价格的条目不参与搭配；营养不完整时不展示合计。' : '体验案例资料仅用于流程体验，不代表实时餐品、价格或营养信息。'}</div>
  </main>;
}
