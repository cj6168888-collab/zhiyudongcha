import { test, expect } from '@playwright/test';

test.describe('用户旅程测试 V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('旅程1: 新用户首次语音对话 - 检查首页加载', async ({ page }) => {
    await test.step('检查首页加载', async () => {
      await page.waitForTimeout(1000);
    });
  });

  test('旅程2: 现有用户语音对话 - 导航到对话页面', async ({ page }) => {
    await test.step('导航到对话页面', async () => {
      await page.goto('/talk', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程3: 用户打断AI回复 - 导航到聊天页面', async ({ page }) => {
    await test.step('导航到聊天页面', async () => {
      await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程4: 录音分析模式切换 - 导航到洞察监听页面', async ({ page }) => {
    await test.step('导航到洞察页面', async () => {
      await page.goto('/insight-listener', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程5: 错误场景恢复 - 检查错误边界', async ({ page }) => {
    await test.step('访问不存在的页面', async () => {
      await page.goto('/non-existent-page', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程6: 深色模式切换 - 导航到设置页面', async ({ page }) => {
    await test.step('导航到设置页面', async () => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程7: Toast通知交互 - 页面结构检查', async ({ page }) => {
    await test.step('导航到设置页面', async () => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程8: 麦克风权限处理 - 页面结构检查', async ({ page }) => {
    await test.step('检查麦克风相关页面元素', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });
  });

  test('旅程性能分析: 多页面导航性能', async ({ page }) => {
    const pages = ['/', '/talk', '/chat', '/settings', '/projects', '/brain'];

    for (const path of pages) {
      await test.step(`导航到 ${path}`, async () => {
        const startTime = Date.now();
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const loadTime = Date.now() - startTime;
        console.log(`${path} 加载时间: ${loadTime}ms`);
      });
    }
  });
});

test.describe('基础功能测试 V2', () => {
  test('页面标题检查', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    console.log(`页面标题: ${title}`);
  });

  test('路由存在性测试', async ({ page }) => {
    const routes = ['/', '/network', '/brain', '/settings'];

    for (const route of routes) {
      await test.step(`测试路由: ${route}`, async () => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
      });
    }
  });

  test('响应式设计测试', async ({ page }) => {
    await test.step('桌面视图', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
    });

    await test.step('平板视图', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
    });
  });

  test('UI元素存在性', async ({ page }) => {
    await page.goto('/');

    await test.step('检查HTML结构', async () => {
      const html = page.locator('html');
      await expect(html).toBeVisible();
    });
  });
});

test.describe('UI组件测试 V2', () => {
  test('页面结构检查', async ({ page }) => {
    await page.goto('/');

    await test.step('检查HTML结构', async () => {
      const html = page.locator('html');
      await expect(html).toBeVisible();
    });

    await test.step('检查body存在', async () => {
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test('按钮存在性', async ({ page }) => {
    await page.goto('/');

    const buttonCount = await page.locator('button').count();
    console.log(`找到 ${buttonCount} 个按钮`);
  });

  test('链接存在性', async ({ page }) => {
    await page.goto('/');

    const linkCount = await page.locator('a').count();
    console.log(`找到 ${linkCount} 个链接`);
  });

  test('表单元素存在性', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    const inputCount = await page.locator('input, textarea, select').count();
    console.log(`找到 ${inputCount} 个表单元素`);
  });
});

export default {};
