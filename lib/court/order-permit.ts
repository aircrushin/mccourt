import { createHmac, timingSafeEqual } from 'node:crypto';
import { mealCategory } from '@/lib/court/recommend';
import type { CourtStore, Meal, OrderPermitToken, Recommendation } from '@/lib/types/index';

export type PermitLine = { id: string; name: string; tags: string[] };
export type OrderPermit = CourtStore & { exp: number; participants: Array<{ id: string; choices: PermitLine[][] }> };
export type OrderItem = { productCode: string; quantity: number; name: string };

const PERMIT_TTL_MS = 2 * 60 * 60 * 1000;

function secret() {
  const value = process.env.ORDER_PERMIT_SECRET?.trim() || process.env.MCD_MCP_TOKEN?.trim();
  if (!value) throw new Error('下单签名未配置。');
  return value;
}

function signatureFor(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function lines(items: Meal[]): PermitLine[] {
  return items.map(item => ({ id: item.id, name: item.name, tags: item.tags ?? [] }));
}

function choicesFrom(recommendation: Recommendation): PermitLine[][] {
  return [recommendation.items, ...recommendation.alternatives.map(alternative => alternative.items)]
    .filter(items => items.length > 0)
    .map(lines);
}

export function permitFromRecommendations(store: CourtStore, recommendations: Recommendation[], now = Date.now()): OrderPermit {
  return {
    ...store,
    exp: now + PERMIT_TTL_MS,
    participants: recommendations.map(recommendation => ({ id: recommendation.participantId, choices: choicesFrom(recommendation) })),
  };
}

export function refreshPermit(permit: OrderPermit, participantId: string, recommendation: Recommendation): OrderPermit {
  if (!recommendation.items.length) return permit;
  return {
    ...permit,
    participants: permit.participants.map(participant => participant.id === participantId
      ? { id: participantId, choices: choicesFrom(recommendation) }
      : participant),
  };
}

export function signOrderPermit(permit: OrderPermit): OrderPermitToken {
  const payload = Buffer.from(JSON.stringify(permit)).toString('base64url');
  return { payload, signature: signatureFor(payload) };
}

export function readOrderPermit(payload: string, signature: string): OrderPermit {
  const expected = signatureFor(payload);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) throw new Error('判决已失效，请重新开庭。');
  let permit: OrderPermit;
  try { permit = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OrderPermit; }
  catch { throw new Error('判决已失效，请重新开庭。'); }
  if (!permit || typeof permit.exp !== 'number' || permit.exp < Date.now()) throw new Error('判决已过期，请重新开庭。');
  if (!permit.storeCode || !Array.isArray(permit.participants)) throw new Error('判决已失效，请重新开庭。');
  return permit;
}

export function resolveSelection(permit: OrderPermit, selections: Array<{ participantId: string; itemIds: string[] }>): OrderItem[] {
  if (selections.length !== permit.participants.length) throw new Error('请确认每一位当事人的餐品后再下单。');
  const chosen: PermitLine[] = [];
  for (const participant of permit.participants) {
    const matches = selections.filter(selection => selection.participantId === participant.id);
    if (matches.length !== 1) throw new Error('请确认每一位当事人的餐品后再下单。');
    const key = [...matches[0].itemIds].sort().join('|');
    const choice = participant.choices.find(items => items.map(item => item.id).sort().join('|') === key);
    if (!choice) throw new Error('所选餐品不在本场判决中。');
    if (choice.some(item => mealCategory({ id: item.id, name: item.name, tags: item.tags, source: '麦当劳 MCP' }) === 'set')) throw new Error('官方套餐暂不能直接下单。');
    chosen.push(...choice);
  }
  const merged = new Map<string, OrderItem>();
  for (const line of chosen) {
    const current = merged.get(line.id) ?? { productCode: line.id, quantity: 0, name: line.name };
    current.quantity += 1;
    merged.set(line.id, current);
  }
  return [...merged.values()];
}
