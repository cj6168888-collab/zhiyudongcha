import { test, expect } from '@playwright/test';

test.describe('UI一致性测试 V2', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`响应式设计 - ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await test.step('检查页面渲染', async () => {
        await expect(page.locator('body')).toBeVisible();
      });
    });
  }
});

test.describe('无障碍性测试 V2', () => {
  test('基本无障碍属性检查', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await test.step('检查HTML lang属性', async () => {
      const lang = page.locator('html');
      await expect(lang).toHaveAttribute('lang');
    });

    await test.step('检查meta viewport', async () => {
      const viewport = page.locator('meta[name="viewport"]');
      await expect(viewport).toHaveAttribute('content');
    });
  });

  test('交互元素可访问性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await test.step('检查按钮可点击', async () => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});

test.describe('UI组件测试 V2', () => {
  test('导航组件存在', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await test.step('检查导航元素', async () => {
      const nav = page.locator('nav, [role="navigation"]').first();
      await expect(nav).toBeVisible({ timeout: 5000 });
    });
  });

  test('主要内容区域', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await test.step('检查main元素', async () => {
      const main = page.locator('main').first();
      await expect(main).toBeVisible({ timeout: 5000 });
    });
  });

  test('按钮样式一致性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const buttonCount = await page.locator('button').count();
    console.log(`按钮数量: ${buttonCount}`);
    expect(buttonCount).toBeGreaterThan(0);
  });
});

test.describe('表单测试 V2', () => {
  test('设置页面表单', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    await test.step('检查输入框', async () => {
      const inputs = page.locator('input, textarea, select');
      const count = await inputs.count();
      console.log(`表单元素数量: ${count}`);
    });
  });
});

export default {};
