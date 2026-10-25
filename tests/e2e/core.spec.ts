import { test, expect } from '@playwright/test';

test('demo case reaches verdict', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /麦门.*法庭/ })).toBeVisible();
  await page.getByRole('button', { name: '体验示例案件' }).click();
  await expect(page.getByText('CASE INTAKE / 新建案件')).toBeVisible();
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  await page.getByRole('button', { name: '跳过动画' }).click();
  await expect(page.getByRole('heading', { name: /麦门人民 法院判决书/ })).toBeVisible();
  await expect(page.getByText('体验资料：以下餐品、价格与营养来自固定案例资料')).toBeVisible();
  await expect(page.getByText('全桌合计')).toBeVisible();
});

test('mobile combinations, alternatives and appeals preserve other participants', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '体验示例案件' }).click();
  await page.locator('input[type="number"]').first().fill('60');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/recommend') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  for (const r of data.verdict.recommendations) {
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.totalPrice).toBeGreaterThan(0);
  }
  await page.getByRole('button', { name: '跳过动画' }).click();
  const first = page.getByRole('article', { name: '小王的推荐组合' });
  const second = page.getByRole('article', { name: '小李的推荐组合' });
  await expect(first.locator('.combination').first().getByText('主食', { exact: true })).toBeVisible();
  await expect(first.locator('.combination').first().getByText('小食', { exact: true })).toBeVisible();
  await expect(first.locator('.combination').first().getByText('饮品', { exact: true })).toBeVisible();
  await expect(first.locator('.combo-total').first()).toContainText('¥36.00');
  const untouched = await second.innerText();
  await first.locator('summary').click();
  await first.getByRole('button', { name: '采用此组合' }).first().click();
  await expect(first.getByRole('status')).toContainText('已采用备选组合');
  expect(await second.innerText()).toBe(untouched);
  const before = Number((await first.locator('.combo-total strong').first().innerText()).replace('¥', ''));
  await first.getByRole('button', { name: '我要上诉' }).click();
  await first.getByRole('button', { name: '太贵了', exact: true }).click();
  await expect(first.getByRole('status')).toContainText('上诉已重新计算');
  const after = Number((await first.locator('.combo-total strong').first().innerText()).replace('¥', ''));
  expect(after).toBeLessThan(before);
  expect(await second.innerText()).toBe(untouched);
  await expect(page.getByText('全桌合计')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'outputs/combinations-mobile.png', fullPage: true });
});
