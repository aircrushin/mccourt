import { test, expect } from '@playwright/test';
import { buildVerdict } from '../../lib/court/judge';

for (const delayed of [false, true]) {
  test(`court completes when ${delayed ? 'a delayed' : 'an immediate'} verdict arrives`, async ({ page }) => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
    await page.route('**/api/recommend', async route => {
      const input = route.request().postDataJSON();
      if (delayed) await responseGate;
      await route.fulfill({ json: {
        verdict: buildVerdict(input.partyName, input.participants, [], false, null),
      } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '体验示例案件' }).click();
    await page.clock.install();
    await page.getByRole('button', { name: '咚！开庭！' }).click();

    if (delayed) {
      await page.clock.runFor(3400);
      await expect(page.locator('.progress-item.done')).toHaveCount(3);
      await expect(page.locator('.progress-item.active')).toHaveText('•正在审理各位的碳水欲望……');
      await expect(page.getByRole('button', { name: '查看判决书' })).toHaveCount(0);
      releaseResponse();
    }

    await expect(page.locator('.progress-item.done')).toHaveCount(4);
    await expect(page.locator('.progress-item.active')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('审理完成，判决书已生成');
    await page.getByRole('button', { name: '查看判决书' }).click();
    await expect(page.getByRole('heading', { name: /麦门人民 法院判决书/ })).toBeVisible();
  });
}
