import { test, expect } from '@playwright/test';

test.describe('吉麟洞察 3.0 全系统功能深度体检', () => {

  test.beforeEach(async ({ page }) => {
    // 增加超时限制到 60 秒，防止模拟器性能波动导致超时
    test.setTimeout(60000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5002', { waitUntil: 'networkidle' });
  });

  test('【体检 1】商务工作台与 5 大专家链路', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('指挥中心');
    const expertIds = ['lawyer', 'finance', 'psychology', 'planner', 'secretary'];
    for (const id of expertIds) {
      await page.goto(`http://localhost:5002/experts/${id}`);
      // 验证页面至少加载了
      await expect(page.locator('header')).toBeVisible();
      await page.goto('http://localhost:5002');
    }
  });

  test('【体检 2】项目建设与人脉资源闭环', async ({ page }) => {
    await page.click('text=项目建设');
    await expect(page.locator('h1')).toContainText('项目中心');
    await page.goto('http://localhost:5002');
    await page.click('text=人脉资源');
    await expect(page.locator('h1')).toContainText('人脉智库');
  });

  test('【体检 3】生产力中心 (深度兼容版)', async ({ page }) => {
    // 1. 进入聆听舱
    const insightBtn = page.getByTestId('nav-item-insight');
    await expect(insightBtn).toBeVisible();
    await insightBtn.click({ force: true });

    // 增加：显式等待 URL 包含 /insight
    await page.waitForURL('**/insight');
    // 使用更宽泛的匹配，防止空格干扰
    await expect(page.locator('h1')).toContainText('聆听舱');

    // 2. 进入智库
    const vaultBtn = page.getByTestId('nav-item-vault');
    await vaultBtn.click({ force: true });
    await page.waitForURL('**/vault');
    await expect(page.locator('h1')).toContainText('智库');
  });

  test('【体检 4】蜂群指挥与高级控制', async ({ page }) => {
    await page.getByTestId('nav-item-control').click({ force: true });
    await page.waitForURL('**/control');
    await expect(page.locator('header')).toContainText('指挥部');
  });

  test('【体检 5】安全防线与资源看板', async ({ page }) => {
    // 使用直接跳转验证 API 路由挂载
    await page.goto('http://localhost:5002/security');
    await expect(page.locator('text=Last Stand Protocol')).toBeVisible();

    await page.goto('http://localhost:5002/resources');
    await expect(page.locator('text=System Vitality')).toBeVisible();
  });
});
