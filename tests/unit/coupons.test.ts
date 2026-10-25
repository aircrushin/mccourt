import { describe, expect, it, vi, beforeEach } from 'vitest';
import { couponsForMeal, parseCoupons } from '../../lib/mcd/coupons';
vi.mock('../../lib/mcd/adapter', () => ({ claimCoupons: vi.fn() }));
import { claimCoupons } from '../../lib/mcd/adapter';
import { POST } from '../../app/api/mcd/coupons/route';

const request = (body: unknown, origin = 'http://localhost') => new Request('http://localhost/api/mcd/coupons', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => vi.clearAllMocks());
describe('recommendation coupons', () => {
  it('parses official Markdown and preserves claimed status', () => {
    expect(parseCoupons({ content: [{ text: '- 优惠券标题：免费脆薯饼 \\\n  状态：可领取 \\\n- 优惠券标题：11.9元麦辣鸡腿堡 \\\n  状态：已领取' }] })).toEqual([{ name: '免费脆薯饼', status: 'available' }, { name: '11.9元麦辣鸡腿堡', status: 'claimed' }]);
  });
  it('matches exact products without mistaking bundles or different variants', () => {
    const coupons = parseCoupons({ structuredContent: { code: 200, data: [
      { couponName: '11.9元麦辣鸡腿堡', label: '可领取' },
      { couponName: '麦辣鸡腿堡套餐', label: '可领取' },
      { couponName: '双层麦辣鸡腿堡', label: '可领取' },
    ] } });
    expect(couponsForMeal('麦辣鸡腿堡', coupons).map(c => c.name)).toEqual(['11.9元麦辣鸡腿堡']);
    expect(couponsForMeal('麦香鸡', coupons)).toEqual([]);
  });
  it('does not treat service errors as an empty successful query', () => {
    expect(() => parseCoupons({ isError: true })).toThrow();
    expect(() => parseCoupons({ structuredContent: { code: 500 } })).toThrow();
  });
  it('rejects invalid and cross-origin requests before calling MCP', async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ couponName: '脆薯饼' }, 'https://other.example'))).status).toBe(403);
    expect(claimCoupons).not.toHaveBeenCalled();
  });
  it('returns a verified claim result and surfaces service failure', async () => {
    vi.mocked(claimCoupons).mockResolvedValueOnce({ claimed: true, message: '领取成功' });
    const response = await POST(request({ couponName: '免费脆薯饼' }));
    expect(await response.json()).toEqual({ claimed: true, message: '领取成功' });
    expect(claimCoupons).toHaveBeenCalledWith('免费脆薯饼');
    vi.mocked(claimCoupons).mockRejectedValueOnce(new Error('private upstream details'));
    const failed = await POST(request({ couponName: '免费脆薯饼' }));
    expect(failed.status).toBe(502);
    expect(JSON.stringify(await failed.json())).not.toContain('private upstream');
  });
  it('accepts the public origin behind a reverse proxy, including its port', async () => {
    vi.mocked(claimCoupons).mockResolvedValue({ claimed: true, message: '领取成功' });
    const proxied = request({ couponName: '免费脆薯饼' }, 'https://mccourt.example:8443');
    proxied.headers.set('host', 'localhost:3000');
    proxied.headers.set('x-forwarded-host', 'mccourt.example:8443');
    proxied.headers.set('x-forwarded-proto', 'https');
    expect((await POST(proxied)).status).toBe(200);
    expect(claimCoupons).toHaveBeenCalledWith('免费脆薯饼');
  });
  it('still rejects cross-site and protocol-mismatched origins behind a proxy', async () => {
    for (const origin of ['https://other.example', 'http://mccourt.example', 'null']) {
      const proxied = request({ couponName: '免费脆薯饼' }, origin);
      proxied.headers.set('x-forwarded-host', 'mccourt.example');
      proxied.headers.set('x-forwarded-proto', 'https');
      expect((await POST(proxied)).status).toBe(403);
    }
    expect(claimCoupons).not.toHaveBeenCalled();
  });
});
