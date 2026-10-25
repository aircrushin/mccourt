import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/mcd/adapter', () => ({ fetchMeals: vi.fn() }));
import { fetchMeals } from '../../lib/mcd/adapter';
import { POST as recommend } from '../../app/api/recommend/route';
import { POST as appeal } from '../../app/api/appeal/route';
import { readOrderPermit } from '../../lib/court/order-permit';
import type { Meal, Participant } from '../../lib/types/index';

const meals: Meal[] = [
  { id:'grilled', name:'板烧鸡腿堡', price:23.5, tags:[], source:'测试资料' },
  { id:'fish', name:'麦香鱼', price:22.5, tags:[], source:'测试资料' },
  { id:'cheap', name:'麦香鸡', price:19.5, tags:[], source:'测试资料' },
  { id:'sprite', name:'雪碧', price:9.5, tags:[], source:'测试资料' },
  { id:'water', name:'纯悦', price:7.5, tags:['饮品'], source:'测试资料' },
  { id:'fries', name:'薯条', price:13.5, tags:[], source:'测试资料' },
];
const store = { storeCode:'test-store', storeName:'测试门店', address:'', distance:null };
const person: Participant = { id:'p1', name:'小王', budget:60, taste:[], goal:'', hunger:3, request:'我要汉堡和雪碧' };
const request = (path: string, body: unknown) => new Request(`http://localhost/api/${path}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENROUTER_API_KEY','');
  vi.stubEnv('ORDER_PERMIT_SECRET','test-only-secret');
  vi.mocked(fetchMeals).mockResolvedValue({ meals, live:true, updatedAt:'2026-10-25T00:00:00.000Z', store });
});
afterEach(() => vi.unstubAllEnvs());

describe('request constraints across recommend and appeal routes', () => {
  it('signs only choices containing the requested drink', async () => {
    const response = await recommend(request('recommend', { partyName:'验证', participants:[person], mode:'live', location:{city:'上海', keyword:'人民广场'} }));
    expect(response.status).toBe(200);
    const { verdict } = await response.json();
    const permit = readOrderPermit(verdict.orderPermit.payload, verdict.orderPermit.signature);
    expect(permit.participants[0].choices.length).toBeGreaterThan(0);
    for (const choice of permit.participants[0].choices) expect(choice.map(item => item.id)).toContain('sprite');
  });

  it('reasserts named items on appeal and excludes both the old combination and rejected foods', async () => {
    const response = await appeal(request('appeal', {
      participant:{...person,request:'我要板烧和雪碧'}, mode:'live', storeCode:store.storeCode,
      previousItemIds:['cheap','water','fries'],
      reason:'我明确要板烧鸡腿堡和雪碧，不要其他汉堡和纯悦，也不要薯条',
    }));
    expect(response.status).toBe(200);
    const { recommendation } = await response.json();
    expect(recommendation.items.map((m: Meal) => m.id).sort()).toEqual(['grilled','sprite']);
    expect(recommendation.requestMatch.satisfied).toBe(true);
    for (const choice of recommendation.alternatives) {
      expect(choice.items.map((m: Meal) => m.id)).toEqual(expect.arrayContaining(['grilled','sprite']));
    }
  });

  it('retains named items after a cheaper appeal or reports that no cheaper choice exists', async () => {
    const response = await appeal(request('appeal', { participant:{...person,request:'只要板烧和雪碧'}, mode:'live', storeCode:store.storeCode, previousItemIds:['grilled','sprite'], reason:'太贵了' }));
    const body = await response.json();
    expect(body.recommendation.items).toEqual([]);
    expect(body.message).toContain('板烧鸡腿堡');
    expect(body.message).toContain('雪碧');
    expect(body.message).toContain('原方案已保留');
  });

  it('explains unavailable appeal items without inventing a stock refusal', async () => {
    const response = await appeal(request('appeal', { participant:person, mode:'live', storeCode:store.storeCode, previousItemIds:['cheap','sprite'], reason:'只要一杯草莓奶昔' }));
    const body = await response.json();
    expect(body.recommendation.items).toEqual([]);
    expect(body.message).toContain('草莓奶昔');
    expect(body.message).toContain('菜单中未找到');
    expect(body.message).toContain('原方案已保留');
  });
});
