import { afterEach, describe, expect, it, vi } from 'vitest';
import { placePickupOrder } from '../../lib/mcd/adapter';

const session = 'sess-order';

function sse(payload: unknown, status = 200) {
  const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new Response(body, { status, headers: { 'mcp-session-id': session, 'content-type': 'text/event-stream' } });
}

function toolOk(data: unknown) {
  return sse({ jsonrpc: '2.0', id: 1, result: { structuredContent: { success: true, code: 200, data } } });
}

describe('placePickupOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MCD_MCP_TOKEN;
  });

  it('prices and creates the order in one session, with default combo choices and no tableware flag', async () => {
    process.env.MCD_MCP_TOKEN = 'test-token';
    const calls: Array<{ url: string; method: string; name?: string; arguments?: any; session?: string | null }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const headers = new Headers(init?.headers);
      calls.push({ url, method: body.method, name: body.params?.name, arguments: body.params?.arguments, session: headers.get('mcp-session-id') });
      if (body.method === 'initialize' || body.method === 'tools/list') return sse({ jsonrpc: '2.0', id: body.id, result: { tools: [] } });
      if (body.params?.name === 'query-meal-detail' && body.params.arguments.code === '1001') {
        return toolOk({ rounds: [{ id: 12, choices: [{ code: '4801', isDefault: 1, quantity: 1 }] }] });
      }
      if (body.params?.name === 'query-meal-detail') return toolOk({ name: '薯条' });
      if (body.params?.name === 'calculate-price') return toolOk({ price: 2990, takeWayList: [{ code: 'takeout', title: '打包带走' }] });
      const order = { orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1' };
      const payload = JSON.stringify({ jsonrpc: '2.0', id: 9, result: { structuredContent: { success: true, data: order } } });
      const split = payload.indexOf('"structuredContent":') + '"structuredContent":'.length;
      return new Response(`event: message\ndata: ${payload.slice(0, split)}\ndata: ${payload.slice(split)}\n\n`, { status: 200, headers: { 'mcp-session-id': session } });
    }));

    await expect(placePickupOrder('1950538', [{ productCode: '1001', quantity: 1 }, { productCode: '2001', quantity: 1 }], 'takeout')).resolves.toEqual({
      orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', pickupCode: null,
    });
    expect(calls.map(call => call.name ?? call.method)).toEqual(['initialize', 'tools/list', 'query-meal-detail', 'query-meal-detail', 'calculate-price', 'create-order']);
    expect(calls.every(call => call.method === 'initialize' || call.session === session)).toBe(true);
    expect(calls.find(call => call.name === 'create-order')?.arguments).toEqual({
      storeCode: '1950538',
      orderType: 1,
      beType: 1,
      takeWayCode: 'takeout',
      items: [
        { productCode: '1001', quantity: 1, roundList: [{ round: '12', comboItemList: [{ code: '4801', quantity: 1 }] }] },
        { productCode: '2001', quantity: 1 },
      ],
    });
    expect(calls.every(call => call.url === 'https://mcp.mcd.cn')).toBe(true);
    expect(JSON.stringify(calls)).not.toContain('needTableware');
  });

  it('stops before create-order when the listed take-away choice is missing or the item is sold out', async () => {
    process.env.MCD_MCP_TOKEN = 'test-token';
    const names: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.params?.name) names.push(body.params.name);
      if (body.method !== 'tools/call') return sse({ jsonrpc: '2.0', id: body.id, result: { tools: [] } });
      if (body.params.name === 'query-meal-detail') return toolOk({ name: '薯条' });
      if (names.filter(name => name === 'calculate-price').length === 1) return toolOk({ price: 1200, takeWayList: [{ code: 'takeout', title: '打包带走' }] });
      return sse({ jsonrpc: '2.0', id: body.id, result: { structuredContent: { success: false, code: 60006, message: '商品已售罄', data: null } } });
    }));
    await expect(placePickupOrder('1950538', [{ productCode: '2001', quantity: 1 }], 'eat-in')).rejects.toThrow('请选择列出的取餐方式');
    await expect(placePickupOrder('1950538', [{ productCode: '2001', quantity: 1 }], 'takeout')).rejects.toThrow('商品已售罄');
    expect(names).not.toContain('create-order');
  });
});
