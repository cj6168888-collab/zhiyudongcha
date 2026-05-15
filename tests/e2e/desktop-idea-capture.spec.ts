import { expect, test, type Page } from '@playwright/test';

const appUrl = 'http://localhost:5173';

async function mockDesktopShell(page: Page) {
  await page.route('**/api/auth/ws-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { token: 'test-token', expiresIn: 3600, role: 'MASTER' } }),
    });
  });
  await page.route('**/api/telemetry/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { requests: { avgResponseTimeMs: 120 } } }),
    });
  });
  await page.route('**/api/remote/devices', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, devices: [{ id: 'pc-1', name: 'Office PC', status: 'ONLINE', platform: 'windows' }] }),
    });
  });
  await page.route('**/api/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, count: 1, data: [{ id: 'task-1', name: 'Review', status: 'ACTIVE' }] }),
    });
  });
  await page.route('**/api/navigator/nodes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nodes: [{ id: 'node-1', name: 'Node 1', type: 'NODE', status: 'ACTIVE', capabilities: [], createdAt: Date.now(), lastActiveAt: Date.now() }], count: 1 }),
    });
  });
  await page.route('**/api/navigator/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalNodes: 1, activeNodes: 1, avgMoraleScore: 86 }),
    });
  });
  await page.route('**/api/navigator/pending-reports', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/navigator/alerts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

test.describe('Desktop idea capture', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('logs in with the sovereign test account and opens idea capture without fake broadcast UI', async ({ page }) => {
    await mockDesktopShell(page);

    await page.goto(`${appUrl}/desktop/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'SOVEREIGN admin / admin' }).click();
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page).toHaveURL(`${appUrl}/desktop`);
    await expect(page.getByText('欢迎回来')).toBeVisible();
    await expect(page.getByRole('button', { name: /PC代理/ }).first()).toBeVisible();
    await expect(page.getByText('指令执行回流')).toBeVisible();
    await expect(page.getByText('远程控制')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '想法暂存' })).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    await expect(page.getByText('出现错误')).toHaveCount(0);

    await page.getByRole('button', { name: /PC代理/ }).first().click();
    await expect(page).toHaveURL(`${appUrl}/desktop/control`);
    await expect(page.getByRole('heading', { name: 'PC 代理执行' })).toBeVisible();
    await expect(page.getByText('这里不是远程桌面。手机不承担鼠标键盘操作，只负责发出目标、确认风险和接收执行汇报。')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);

    await page.goto(`${appUrl}/desktop/inspiration`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('先记下这个想法，再回到和小智的对话里继续展开...')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    await expect(page.getByText('灵感广播')).toHaveCount(0);
    await expect(page.getByText('广播至全舰队')).toHaveCount(0);
    await expect(page.getByText('语义血缘')).toHaveCount(0);

    await page.getByRole('textbox').fill('桌面端也只暂存想法，不做假广播');
    await page.getByRole('button', { name: '暂存想法' }).click();

    await expect(page.getByRole('textbox')).toHaveValue('');
    await expect.poll(() => page.evaluate(() =>
      window.localStorage.getItem('xiaozhi_idea_capture_notes')?.includes('桌面端也只暂存想法，不做假广播') ?? false
    )).toBe(true);
  });
});
