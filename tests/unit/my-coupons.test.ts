import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMyCoupons } from '../../lib/mcd/my-coupons';
vi.mock('../../lib/mcd/adapter', () => ({ fetchMyCoupons: vi.fn() }));
import { fetchMyCoupons } from '../../lib/mcd/adapter';
import { GET } from '../../app/api/mcd/my-coupons/route';

const data = {
  coupons: [{
    title: '麦辣鸡腿堡三件套', code: 'private-coupon-code', id: 'private-id',
    image: 'https://img.mcd.cn/coupon.png', datetimeText: '2026-10-23 至 2026-11-23 10:30-23:59',
    discountInfo: { discountValue: '22.9', discountDesc: '用券价格', discountTypeText: '¥' },
    tags: [{ label: '到店专用' }], enable: 1,
    currentChannelCanRedeem: false, toastText: '该券仅限麦当劳App使用',
  }], currentPage: 1, pageSize: 20, totalCount: 1, totalPages: 1,
};
const result = (value: unknown) => ({ structuredContent: { code: 200, data: value } });
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('my coupon wallet', () => {
  it('preserves price meaning, time restrictions and channel restrictions without exposing redemption codes', () => {
    const wallet = parseMyCoupons(result(data));
    expect(wallet.coupons[0]).toMatchObject({
      title: '麦辣鸡腿堡三件套', discount: { value: '22.9', description: '用券价格', symbol: '¥' },
      tags: ['到店专用'], validity: data.coupons[0].datetimeText,
      restrictions: ['该券仅限麦当劳App使用', '当前渠道不可直接核销，请按券面要求使用'],
    });
    expect(JSON.stringify(wallet)).not.toContain('private-');
  });
  it('handles empty wallets, missing fields, invalid image URLs and unknown availability', () => {
    expect(parseMyCoupons(result({ ...data, coupons: [], totalCount: 0, totalPages: 0 })).coupons).toEqual([]);
    const wallet = parseMyCoupons(result({ ...data, coupons: [{ title: '券', image: 'javascript:alert(1)' }] }));
    expect(wallet.coupons[0]).toMatchObject({ image: null, validity: null, enable: null, discount: null });
  });
  it('parses JSON text responses and rejects upstream errors or unreadable data', () => {
    expect(parseMyCoupons({ content: [{ text: JSON.stringify({ code: 200, data }) }] }).totalCount).toBe(1);
    for (const response of [{ isError: true }, { structuredContent: { code: 500 } }, result({}), { content: [{ text: '暂不可用' }] }]) {
      expect(() => parseMyCoupons(response)).toThrow();
    }
  });
  it('rejects out-of-range pages and missing account configuration without calling MCP', async () => {
    for (const page of ['0', '6', '1.5', 'abc', '']) {
      expect((await GET(new Request(`http://localhost/api/mcd/my-coupons?page=${page}`))).status).toBe(400);
    }
    vi.stubEnv('MCD_MCP_TOKEN', '');
    expect((await GET(new Request('http://localhost/api/mcd/my-coupons'))).status).toBe(503);
    expect(fetchMyCoupons).not.toHaveBeenCalled();
  });
  it('forwards pagination, disables caching and hides upstream errors', async () => {
    vi.stubEnv('MCD_MCP_TOKEN', 'test-only-token');
    vi.mocked(fetchMyCoupons).mockResolvedValueOnce({ ...parseMyCoupons(result(data)), updatedAt: '2026-10-25T08:00:00Z' });
    const response = await GET(new Request('http://localhost/api/mcd/my-coupons?page=2'));
    expect(fetchMyCoupons).toHaveBeenCalledWith(2);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).totalCount).toBe(1);
    vi.mocked(fetchMyCoupons).mockRejectedValueOnce(new Error('private upstream details'));
    const failed = await GET(new Request('http://localhost/api/mcd/my-coupons'));
    expect(failed.status).toBe(502);
    expect(JSON.stringify(await failed.json())).not.toContain('private upstream');
  });
});
