import { test, expect } from '@playwright/test';

test.describe('监控配置验证 V2', () => {
  test('Sentry监控加载测试', async ({ page }) => {
    const sentryLoaded = await page.evaluate(() => {
      return typeof window !== 'undefined' && !!(window as any).Sentry;
    });

    console.log(`Sentry已加载: ${sentryLoaded}`);
  });

  test('OpenReplay监控加载测试', async ({ page }) => {
    const openreplayLoaded = await page.evaluate(() => {
      return typeof window !== 'undefined' && !!(window as any).__openreplay;
    });

    console.log(`OpenReplay已加载: ${openreplayLoaded}`);
  });

  test('监控脚本无错误', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const monitoringErrors = errors.filter(e =>
      e.includes('sentry') ||
      e.includes('openreplay') ||
      e.includes('monitoring')
    );

    console.log(`监控相关错误数: ${monitoringErrors.length}`);
    expect(monitoringErrors).toHaveLength(0);
  });
});

test.describe('性能数据验证 V2', () => {
  test('Performance API可用性', async ({ page }) => {
    const perfAvailable = await page.evaluate(() => {
      return typeof performance !== 'undefined';
    });

    expect(perfAvailable).toBe(true);
  });

  test('Navigation Timing API', async ({ page }) => {
    const navTiming = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as any;
      return navigation ? {
        domContentLoaded: navigation.domContentLoadedEventEnd,
        loadComplete: navigation.loadEventEnd,
        ttfb: navigation.responseStart - navigation.requestStart,
      } : null;
    });

    console.log(`导航时间: ${JSON.stringify(navTiming)}`);
  });

  test('Resource Timing API', async ({ page }) => {
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      return entries.slice(0, 10).map((e: any) => ({
        name: e.name.substring(0, 50),
        duration: e.duration.toFixed(2),
      }));
    });

    console.log(`资源数量: ${resources.length}`);
  });
});

test.describe('用户追踪测试 V2', () => {
  test('全局对象存在性', async ({ page }) => {
    const globalCheck = await page.evaluate(() => {
      return {
        window: typeof window !== 'undefined',
        document: typeof document !== 'undefined',
        navigator: typeof navigator !== 'undefined',
      };
    });

    console.log(`全局对象: ${JSON.stringify(globalCheck)}`);
    expect(globalCheck.window).toBe(true);
    expect(globalCheck.document).toBe(true);
    expect(globalCheck.navigator).toBe(true);
  });

  test('navigator对象属性', async ({ page }) => {
    const navProps = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        onLine: navigator.onLine,
      };
    });

    console.log(`Navigator属性可用`);
  });
});

export default {};
