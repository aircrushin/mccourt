import { test, expect } from '@playwright/test';

test('recommended coupon can be claimed with loading and verified feedback', async ({ page }) => {
  let claims = 0;
  await page.route('**/api/recommend', async route => {
    const input = route.request().postDataJSON();
    const recommendations = input.participants.map((p: { id: string }) => ({
      participantId: p.id, items: [{ id: 'chicken', name: '麦辣鸡腿堡', price: 20, tags: [], source: '麦当劳 MCP', coupons: [{ name: '11.9元麦辣鸡腿堡', status: 'available' }] }],
      totalPrice: 20, calories: null, protein: null, score: 50, reason: '测试组合', constraints: [], alternatives: [],
    }));
    await route.fulfill({ json: { verdict: { caseNumber: 'MC-test', caseName: '测试案件', opening: '测试', opinions: [], ruling: '测试判决', recommendations, live: true, sourceUpdatedAt: null } } });
  });
  await page.route('**/api/mcd/coupons', async route => {
    claims++;
    expect(route.request().postDataJSON()).toEqual({ couponName: '11.9元麦辣鸡腿堡' });
    await route.fulfill({ json: { claimed: true, message: '领取成功，可前往麦当劳查看使用条件。' } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '体验示例案件' }).click();
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  await page.getByRole('button', { name: '跳过动画' }).click();
  const card = page.getByRole('article', { name: '小王的推荐组合' });
  await expect(card.getByText('相关优惠券 · 11.9元麦辣鸡腿堡')).toBeVisible();
  await card.getByRole('button', { name: '领券（同时领取全部可领券）' }).click();
  await expect(card.getByText('已领取 · 使用条件以麦当劳券包为准')).toBeVisible();
  await expect(card.locator('.combo-total')).toContainText('¥20.00');
  expect(claims).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
