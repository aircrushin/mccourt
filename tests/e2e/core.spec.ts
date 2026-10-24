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
});
