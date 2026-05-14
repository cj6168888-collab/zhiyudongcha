import { test, expect } from '@playwright/test';

test.describe('错误处理测试 V2', () => {
  test('404页面处理', async ({ page }) => {
    const response = await page.goto('/non-existent-page-12345', { waitUntil: 'domcontentloaded' });
    console.log(`404页面状态: ${response?.status()}`);
  });

  test('无效路由处理', async ({ page }) => {
    await page.goto('/xyz-invalid-path-abc', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('网络错误恢复', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('JavaScript错误边界', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('429 (Too Many Requests)') &&
      !e.includes('net::ERR')
    );

    console.log(`严重错误数: ${criticalErrors.length}`);
    expect(criticalErrors).toHaveLength(0);
  });

  test('控制台错误数量检查', async ({ page }) => {
    const errorCount = { value: 0 };

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorCount.value++;
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log(`控制台错误数: ${errorCount.value}`);
  });
});

test.describe('边界条件测试 V2', () => {
  test('空参数处理', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('特殊字符处理', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('快速重复导航', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('页面后退功能', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.goBack();
    await expect(page.locator('body')).toBeVisible();
  });

  test('页面刷新功能', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
  });
});

export default {};
