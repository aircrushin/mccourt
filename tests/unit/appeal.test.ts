import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/appeal/route';
import { demoMeals } from '../../lib/court/demo-meals';
import { foodUnits, recommend } from '../../lib/court/recommend';
import type { Participant } from '../../lib/types/index';
const participant: Participant = { id: 'p1', name: '小王', budget: 60, taste: [], goal: '', hunger: 3, request: '想吃汉堡' };
const post = (body: unknown) => POST(new Request('http://localhost/api/appeal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('combination appeals API', () => {
  it('returns a strictly cheaper replacement while retaining original preferences', async () => {
    const [first] = recommend([participant], demoMeals);
    const response = await post({ participant, reason: '太贵了', mode: 'demo', previousItemIds: first.items.map(m => m.id) });
    expect(response.status).toBe(200);
    const { recommendation } = await response.json();
    expect(recommendation.items.length).toBeGreaterThan(0);
    expect(recommendation.totalPrice).toBeLessThan(first.totalPrice!);
    expect(recommendation.totalPrice).toBeLessThanOrEqual(participant.budget);
  });
  it('replaces the combination with more food after not-enough-food appeal', async () => {
    const [first] = recommend([participant], demoMeals);
    const response = await post({ participant, reason: '不够饱', mode: 'demo', previousItemIds: first.items.map(m => m.id) });
    const { recommendation } = await response.json();
    expect(foodUnits(recommendation.items)).toBeGreaterThan(foodUnits(first.items));
    expect(recommendation.totalPrice).toBeLessThanOrEqual(participant.budget);
  });
  it('explains when no cheaper replacement is possible', async () => {
    const response = await post({ participant: { ...participant, budget: 6 }, reason: '太贵了', mode: 'demo', previousItemIds: ['demo-drink'] });
    const data = await response.json();
    expect(data.recommendation.items).toEqual([]);
    expect(data.message).toContain('原方案已保留');
  });
  it('rejects invalid request data before accessing services', async () => {
    const response = await post({ participant, reason: '', mode: 'demo' });
    expect(response.status).toBe(400);
  });
});
