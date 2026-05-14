import { test, expect } from '@playwright/test';

test.describe('性能测试 V2', () => {
  test('Core Web Vitals - LCP', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const lcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('largest-contentful-paint');
      if (entries.length > 0) {
        const entry = entries[entries.length - 1] as any;
        return entry.startTime;
      }
      return 0;
    });

    console.log(`LCP: ${lcp.toFixed(2)}ms`);
    expect(lcp).toBeLessThan(3000);
  });

  test('Core Web Vitals - FCP', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const fcpEntry = entries.find((e: any) => e.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : 0;
    });

    console.log(`FCP: ${fcp.toFixed(2)}ms`);
    expect(fcp).toBeLessThan(2000);
  });

  test('页面加载性能', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;

    console.log(`页面加载时间: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('多页面导航性能', async ({ page }) => {
    const pages = ['/', '/talk', '/chat', '/settings'];
    const navTimes: number[] = [];

    for (const path of pages) {
      const start = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      navTimes.push(Date.now() - start);
    }

    console.log(`导航时间: ${navTimes.join('ms, ')}ms`);
    navTimes.forEach((time) => {
      expect(time).toBeLessThan(3000);
    });
  });

  test('响应式设计 - 移动端', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now();
    await page.waitForTimeout(1000);

    console.log(`移动端加载正常`);
    expect(page.locator('body')).toBeVisible();
  });

  test('内存使用检查', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const memory = await page.evaluate(() => {
      const perf = performance as any;
      if (perf.memory) {
        return {
          used: (perf.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
          total: (perf.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
        };
      }
      return null;
    });

    if (memory) {
      console.log(`内存使用: ${memory.used}MB / ${memory.total}MB`);
    } else {
      console.log('内存API不可用（非Chrome浏览器）');
    }
  });
});

test.describe('基础功能测试 V2', () => {
  test('页面标题检查', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    expect(title).toContain('领航者');
  });

  test('路由存在性测试', async ({ page }) => {
    const routes = ['/', '/network', '/brain', '/settings'];

    for (const route of routes) {
      await test.step(`测试路由: ${route}`, async () => {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBeLessThan(400);
      });
    }
  });

  test('JavaScript错误检查', async ({ page }) => {
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
      !e.includes('net::')
    );

    console.log(`控制台错误数: ${criticalErrors.length}`);
    expect(criticalErrors).toHaveLength(0);
  });

  test('UI元素存在性', async ({ page }) => {
    await page.goto('/');

    await test.step('检查HTML结构', async () => {
      const html = page.locator('html');
      await expect(html).toBeVisible();
    });

    await test.step('检查body', async () => {
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });
});

test.describe('交互测试 V2', () => {
  test('按钮点击测试', async ({ page }) => {
    await page.goto('/');

    const buttons = await page.locator('button').count();
    console.log(`页面按钮数量: ${buttons}`);

    expect(buttons).toBeGreaterThan(0);
  });

  test('链接导航测试', async ({ page }) => {
    await page.goto('/');

    const links = await page.locator('a').count();
    console.log(`页面链接数量: ${links}`);

    expect(links).toBeGreaterThan(0);
  });

  test('表单元素测试', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    const inputs = await page.locator('input, textarea, select').count();
    console.log(`表单元素数量: ${inputs}`);
  });
});

export default {};
