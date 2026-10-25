import { test, expect } from '@playwright/test';

test('live verdict can quote the nearest store and open payment', async ({ page }) => {
  await page.addInitScript(() => {
    const position = { coords: { latitude: 31.2304, longitude: 121.4737, accuracy: 20, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
    navigator.geolocation.getCurrentPosition = (success: PositionCallback) => success(position as GeolocationPosition);
  });
  await page.route('**/api/recommend', async route => {
    const input = route.request().postDataJSON();
    expect(input.location.latitude).toBeCloseTo(31.23, 1);
    expect(input.location.longitude).toBeCloseTo(121.47, 1);
    await route.fulfill({ json: { verdict: {
      caseNumber: 'MC-pay', caseName: '支付测试', opening: '测试', opinions: [], ruling: '可以支付',
      recommendations: [{ participantId: input.participants[0].id, items: [{ id: '1001', name: '麦辣鸡腿堡', price: 20, tags: ['主食'], source: '麦当劳 MCP' }], totalPrice: 20, calories: null, protein: null, score: 10, reason: '测试组合', constraints: [], alternatives: [] }],
      live: true, sourceUpdatedAt: null,
      store: { storeCode: '1950538', storeName: '外滩餐厅', address: '中山东一路 1 号', distance: 320 },
      orderPermit: { payload: 'permit-payload', signature: 'permit-signature' },
    } } });
  });
  await page.route('**/api/mcd/order', async route => {
    const body = route.request().postDataJSON();
    expect(body.payload).toBe('permit-payload');
    expect(body.signature).toBe('permit-signature');
    if (!body.takeWayCode) {
      await route.fulfill({ json: { quote: {
        price: 29.9, originalPrice: 32, discount: 2.1,
        items: [{ productCode: '1001', name: '麦辣鸡腿堡', quantity: 1, subtotal: 20 }],
        takeWays: [{ code: 'takeout', title: '打包带走', subtitle: null }],
        store: { storeName: '外滩餐厅', address: '中山东一路 1 号', distance: 320 },
      } } });
      return;
    }
    expect(body.takeWayCode).toBe('takeout');
    await route.fulfill({ json: { order: { orderId: 'OID-1', payH5Url: 'https://pay.mcd.cn/h5/1', pickupCode: '8848' } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '立即开庭' }).click();
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  await page.getByRole('button', { name: '跳过动画' }).click();
  await expect(page.getByText('最近门店：外滩餐厅 · 中山东一路 1 号 · 约 320 米')).toBeVisible();
  await page.getByRole('button', { name: '服判' }).click();
  await page.getByRole('button', { name: '判决生效' }).click();
  await page.getByRole('button', { name: '去支付这份判决' }).click();
  await expect(page.getByText('应付')).toBeVisible();
  await expect(page.locator('.combo-total strong').last()).toHaveText('¥29.90');
  await page.getByRole('button', { name: '确认下单' }).click();
  await expect(page.getByText('订单号 OID-1')).toBeVisible();
  await expect(page.getByText('取餐码 8848')).toBeVisible();
  await expect(page.getByRole('link', { name: '前往支付' })).toHaveAttribute('href', 'https://pay.mcd.cn/h5/1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('live court uses a typed place when location is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success: PositionCallback, error?: PositionErrorCallback | null) => error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
  });
  let location: { city?: string; keyword?: string } | undefined;
  await page.route('**/api/recommend', async route => {
    location = route.request().postDataJSON().location;
    const input = route.request().postDataJSON();
    await route.fulfill({ json: { verdict: {
      caseNumber: 'MC-place', caseName: '地点测试', opening: '测试', opinions: [], ruling: '可以开庭',
      recommendations: [{ participantId: input.participants[0].id, items: [{ id: '1001', name: '麦辣鸡腿堡', price: 20, tags: ['主食'], source: '麦当劳 MCP' }], totalPrice: 20, calories: null, protein: null, score: 10, reason: '测试组合', constraints: [], alternatives: [] }],
      live: true, sourceUpdatedAt: null,
      store: { storeCode: '1950538', storeName: '外滩餐厅', address: '中山东一路 1 号', distance: 180 },
      orderPermit: null,
    } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '立即开庭' }).click();
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  await expect(page.getByText('没有拿到位置')).toBeVisible();
  await page.getByLabel('城市（可选，填写后按这里找最近门店）').fill('上海');
  await page.getByLabel('地标').fill('外滩');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  await page.getByRole('button', { name: '跳过动画' }).click();
  await expect(page.getByText('最近门店：外滩餐厅')).toBeVisible();
  expect(location).toEqual({ city: '上海', keyword: '外滩' });
});

test('sample verdict does not offer payment', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '体验示例案件' }).click();
  await page.getByRole('button', { name: '咚！开庭！' }).click();
  await page.getByRole('button', { name: '跳过动画' }).click();
  for (const name of ['小王', '小李', '小张']) {
    await page.getByRole('article', { name: `${name}的推荐组合` }).getByRole('button', { name: '服判' }).click();
  }
  await page.getByRole('button', { name: '判决生效' }).click();
  await expect(page.getByText('判决生效！各位当事人，开吃。')).toBeVisible();
  await expect(page.getByRole('button', { name: '去支付这份判决' })).toHaveCount(0);
});
