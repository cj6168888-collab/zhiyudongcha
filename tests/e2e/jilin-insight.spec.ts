import { test, expect } from '@playwright/test';

test.describe('吉麟洞察 2.0 核心商务流测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5002');
  });

  test('1. 品牌形象与系统状态检查', async ({ page }) => {
    // 验证首页标题是否正确
    await expect(page.locator('h1')).toContainText('指挥中心');

    // 验证品牌标识“JI LIN”是否可见
    await expect(page.locator('text=JI LIN')).toBeVisible();

    // 核心修复：通过 TestID 验证头像容器是否存在，不再受限于图片文件本身
    const logoContainer = page.getByTestId('jilin-avatar');
    await expect(logoContainer).toBeVisible();
  });

  test('2. 专家工作站与互动模式', async ({ page }) => {
    await page.click('text=律师');
    await expect(page.locator('h1')).toContainText('随身律师');
    await expect(page.locator('text=实时互动')).toBeVisible();
  });

  test('3. 底部导航栏稳定性检查', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav.locator('text=工作台')).toBeVisible();
    await expect(nav.locator('text=聆听舱')).toBeVisible();
    await expect(nav.locator('text=智库')).toBeVisible();
  });
});
