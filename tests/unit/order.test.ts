import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/mcd/adapter', () => ({
  fetchMeals: vi.fn(),
  quotePickup: vi.fn(),
  placePickupOrder: vi.fn(),
}));

import { fetchMeals, placePickupOrder, quotePickup } from '../../lib/mcd/adapter';
import { POST as recommend } from '../../app/api/recommend/route';
import { POST as appeal } from '../../app/api/appeal/route';
import { POST as order } from '../../app/api/mcd/order/route';
import { readOrderPermit, resolveSelection, signOrderPermit } from '../../lib/court/order-permit';
import { parseCreatedOrder, parseMcpRpc, parsePriceQuote, readToolData, selectionsFromMealDetail } from '../../lib/mcd/order-price';
import type { Participant } from '../../lib/types/index';

const participant: Participant = { id: 'p1', name: '小王', budget: 40, taste: [], goal: '', hunger: 3, request: '想吃汉堡' };
const store = { storeCode: '1950538', storeName: '外滩餐厅', address: '中山东一路 1 号', distance: 320 };
const burger = { id: '1001', name: '麦辣鸡腿堡', price: 20, tags: ['主食'], source: '麦当劳 MCP' };
const fries = { id: '2001', name: '薯条', price: 12, tags: ['小食'], source: '麦当劳 MCP' };
const combo = { id: '9001', name: '麦辣鸡腿堡套餐', price: 32, tags: ['套餐'], source: '麦当劳 MCP' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ORDER_PERMIT_SECRET = 'test-permit-secret';
});

describe('price and payment parsing', () => {
  it('converts fen prices and keeps take-away choices', () => {
    expect(parsePriceQuote({
      price: 2990,
      originalPrice: 3200,
      discount: 210,
      productList: [{ productCode: '1001', productName: '麦辣鸡腿堡', quantity: 1, subtotal: 2000 }],
      takeWayList: [{ code: 'eat-in', title: '店内用餐', subtitle: '堂食' }, { code: 'takeout', title: '打包带走' }],
    })).toEqual({
      price: 29.9,
      originalPrice: 32,
      discount: 2.1,
      items: [{ productCode: '1001', name: '麦辣鸡腿堡', quantity: 1, subtotal: 20 }],
      takeWays: [{ code: 'eat-in', title: '店内用餐', subtitle: '堂食' }, { code: 'takeout', title: '打包带走', subtitle: null }],
    });
  });

  it('rejects a quote without a payable amount or a take-away choice', () => {
    expect(() => parsePriceQuote({ price: 1000, takeWayList: [] })).toThrow('暂时无法确认取餐方式');
    expect(() => parsePriceQuote({ takeWayList: [{ code: 'eat-in', title: '店内用餐' }] })).toThrow('暂时无法核实应付金额');
  });

  it('reads a streamed MCP result and a business refusal', () => {
    const streamed = 'event: message\ndata: {"jsonrpc":"2.0","id":9,"result":{"structuredContent":\ndata: {"success":true,"data":{"orderId":"OID-1","payH5Url":"https://pay.mcd.cn/h5/1"}}}}\n\n';
    expect(parseCreatedOrder(readToolData(parseMcpRpc(streamed).result))).toEqual({ orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', pickupCode: null });
    expect(() => readToolData({ structuredContent: { success: false, code: 60006, message: '商品已售罄', data: null } })).toThrow('商品已售罄');
  });

  it('keeps the menu default combo choices for ordering', () => {
    expect(selectionsFromMealDetail({
      rounds: [{ id: 12, minQuantity: 1, choices: [{ code: '4801', name: '中可乐', isDefault: 1, quantity: 1 }, { code: '4802', name: '雪碧', isDefault: 0, quantity: 0 }] }],
      modification: { items: [{ values: [{ code: 'ice', selectedKey: 'yes', unselectedKey: 'no', selectedQuantity: 1 }, { code: 'sugar', selectedKey: 'add', unselectedKey: 'none', selectedQuantity: 0 }] }] },
    })).toEqual({
      roundList: [{ round: '12', comboItemList: [{ code: '4801', quantity: 1 }] }],
      modification: { values: [{ code: 'ice', key: 'yes', quantity: 1 }, { code: 'sugar', key: 'none', quantity: 0 }] },
    });
    expect(selectionsFromMealDetail({ name: '薯条' })).toEqual({});
  });

  it('accepts only an https payment link', () => {
    expect(parseCreatedOrder({ orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', orderDetail: { pickupCode: '8848' } })).toEqual({
      orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', pickupCode: '8848',
    });
    expect(() => parseCreatedOrder({ orderId: 'OID-1', payH5Url: 'http://pay.example/x' })).toThrow('没有可用的支付链接');
  });
});

describe('order permit', () => {
  const permit = {
    storeCode: store.storeCode,
    storeName: store.storeName,
    address: store.address,
    distance: store.distance,
    exp: Date.now() + 60_000,
    participants: [{
      id: 'p1',
      choices: [
        [{ id: '1001', name: '麦辣鸡腿堡', tags: ['主食'] }, { id: '2001', name: '薯条', tags: ['小食'] }],
        [{ id: '9001', name: '麦辣鸡腿堡套餐', tags: ['套餐'] }],
      ],
    }],
  };

  it('rejects a tampered payload and an expired permit', () => {
    const signed = signOrderPermit(permit);
    expect(readOrderPermit(signed.payload, signed.signature).storeCode).toBe(store.storeCode);
    expect(() => readOrderPermit(signed.payload, 'tampered')).toThrow('判决已失效');
    const expired = signOrderPermit({ ...permit, exp: Date.now() - 1000 });
    expect(() => readOrderPermit(expired.payload, expired.signature)).toThrow('判决已过期');
  });

  it('merges only the chosen verdict items and refuses an official combo', () => {
    expect(resolveSelection(permit, [{ participantId: 'p1', itemIds: ['2001', '1001'] }])).toEqual([
      { productCode: '1001', quantity: 1, name: '麦辣鸡腿堡' },
      { productCode: '2001', quantity: 1, name: '薯条' },
    ]);
    expect(() => resolveSelection(permit, [{ participantId: 'p1', itemIds: ['404'] }])).toThrow('所选餐品不在本场判决中');
    expect(() => resolveSelection(permit, [{ participantId: 'p1', itemIds: ['9001'] }])).toThrow('官方套餐暂不能直接下单');
  });
});

describe('recommend and appeal keep the nearest store', () => {
  it('passes the user location to the menu lookup and signs that store into the verdict', async () => {
    vi.mocked(fetchMeals).mockResolvedValue({
      meals: [burger, fries], live: true, updatedAt: '2026-10-25T00:00:00.000Z', store,
    });
    const response = await recommend(new Request('http://localhost/api/recommend', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ partyName: '外滩午餐', participants: [participant], mode: 'live', location: { latitude: 31.23, longitude: 121.47 } }),
    }));
    expect(response.status).toBe(200);
    expect(fetchMeals).toHaveBeenCalledWith({ latitude: 31.23, longitude: 121.47 });
    const { verdict } = await response.json();
    expect(verdict.store).toEqual(store);
    expect(readOrderPermit(verdict.orderPermit.payload, verdict.orderPermit.signature).storeCode).toBe(store.storeCode);
  });

  it('does not look up a store for the sample case', async () => {
    const response = await recommend(new Request('http://localhost/api/recommend', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ partyName: '示例', participants: [participant], mode: 'demo' }),
    }));
    expect(response.status).toBe(200);
    expect(fetchMeals).not.toHaveBeenCalled();
    const { verdict } = await response.json();
    expect(verdict.store).toBeNull();
    expect(verdict.orderPermit).toBeNull();
  });

  it('recalculates an appeal against the same store and refreshes the permit', async () => {
    vi.mocked(fetchMeals).mockResolvedValue({ meals: [burger, fries], live: true, updatedAt: null, store });
    const opened = await recommend(new Request('http://localhost/api/recommend', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ partyName: '外滩午餐', participants: [{ ...participant, budget: 80 }], mode: 'live', location: { city: '上海', keyword: '外滩' } }),
    }));
    const first = await opened.json();
    vi.mocked(fetchMeals).mockClear();
    const response = await appeal(new Request('http://localhost/api/appeal', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        participant: { ...participant, budget: 80 },
        reason: '想换个口味',
        previousItemIds: first.verdict.recommendations[0].items.map((item: { id: string }) => item.id),
        mode: 'live',
        storeCode: store.storeCode,
        orderPermit: first.verdict.orderPermit,
      }),
    }));
    expect(fetchMeals).toHaveBeenCalledWith({ storeCode: store.storeCode });
    const data = await response.json();
    const refreshed = readOrderPermit(data.orderPermit.payload, data.orderPermit.signature);
    expect(refreshed.storeCode).toBe(store.storeCode);
    const ids = refreshed.participants[0].choices.map(choice => choice.map(item => item.id).sort().join('|'));
    expect(ids).toContain(data.recommendation.items.map((item: { id: string }) => item.id).sort().join('|'));
  });
});

describe('order route', () => {
  const signed = () => signOrderPermit({
    storeCode: store.storeCode, storeName: store.storeName, address: store.address, distance: 320,
    exp: Date.now() + 60_000,
    participants: [{ id: 'p1', choices: [[{ id: burger.id, name: burger.name, tags: burger.tags }, { id: fries.id, name: fries.name, tags: fries.tags }]] }],
  });
  const request = (body: unknown, origin = 'http://localhost') => new Request('http://localhost/api/mcd/order', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  it('returns a quote without creating an order', async () => {
    vi.mocked(quotePickup).mockResolvedValue({
      price: 29.9, originalPrice: 32, discount: 2.1,
      items: [{ productCode: '1001', name: '麦辣鸡腿堡', quantity: 1, subtotal: 20 }],
      takeWays: [{ code: 'takeout', title: '打包带走', subtitle: null }],
    });
    const response = await order(request({ ...signed(), selections: [{ participantId: 'p1', itemIds: ['1001', '2001'] }] }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.quote.price).toBe(29.9);
    expect(data.quote.store).toEqual({ storeName: store.storeName, address: store.address, distance: 320 });
    expect(placePickupOrder).not.toHaveBeenCalled();
    expect(quotePickup).toHaveBeenCalledWith(store.storeCode, [
      { productCode: '1001', quantity: 1 },
      { productCode: '2001', quantity: 1 },
    ]);
  });

  it('creates the order without pricing it twice and shows a McDonald refusal', async () => {
    vi.mocked(placePickupOrder).mockImplementation(async (_store, _items, code) => {
      if (code !== 'takeout') throw new Error('请选择列出的取餐方式。');
      return { orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', pickupCode: '8848' };
    });
    const body = { ...signed(), selections: [{ participantId: 'p1', itemIds: ['1001', '2001'] }] };
    expect((await order(request({ ...body, takeWayCode: 'eat-in' }))).status).toBe(400);
    expect(quotePickup).not.toHaveBeenCalled();
    const response = await order(request({ ...body, takeWayCode: 'takeout' }));
    expect(await response.json()).toEqual({ order: { orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', pickupCode: '8848' } });
    expect(quotePickup).not.toHaveBeenCalled();
    expect(placePickupOrder).toHaveBeenCalledWith(store.storeCode, [
      { productCode: '1001', quantity: 1 },
      { productCode: '2001', quantity: 1 },
    ], 'takeout');
    vi.mocked(placePickupOrder).mockRejectedValueOnce(new Error('MCP 60006: 商品已售罄'));
    const refused = await order(request({ ...body, takeWayCode: 'takeout' }));
    expect(refused.status).toBe(502);
    expect(await refused.json()).toEqual({ error: '商品已售罄' });
  });

  it('rejects cross-origin, sample-sized tampering, and official combos before calling McDonald’s', async () => {
    const comboPermit = signOrderPermit({
      storeCode: store.storeCode, storeName: store.storeName, address: store.address, distance: null,
      exp: Date.now() + 60_000,
      participants: [{ id: 'p1', choices: [[{ id: combo.id, name: combo.name, tags: combo.tags }]] }],
    });
    expect((await order(request({ ...signed(), selections: [{ participantId: 'p1', itemIds: ['1001', '2001'] }] }, 'https://other.example'))).status).toBe(403);
    expect((await order(request({ ...comboPermit, selections: [{ participantId: 'p1', itemIds: [combo.id] }] }))).status).toBe(400);
    expect(quotePickup).not.toHaveBeenCalled();
  });
});
