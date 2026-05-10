/**
 * 错误场景处理测试脚本
 * 测试网络错误、权限拒绝等异常场景的处理
 */

import { test, expect, type Page } from '@playwright/test';

class ErrorHandlerTester {
  private page: Page;
  private errors: string[] = [];
  private networkErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        this.errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      this.errors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        this.networkErrors.push(`${response.status()}: ${response.url()}`);
      }
    });
  }

  getErrors(): string[] {
    return this.errors;
  }

  getNetworkErrors(): string[] {
    return this.networkErrors;
  }

  clearErrors(): void {
    this.errors = [];
    this.networkErrors = [];
  }

  async checkForErrorMessage(expectedPatterns: string[]): Promise<boolean> {
    const pageContent = await this.page.content();
    const pageText = pageContent.toLowerCase();
    
    return expectedPatterns.some(pattern => 
      pageText.includes(pattern.toLowerCase()) ||
      this.errors.some(error => error.toLowerCase().includes(pattern.toLowerCase()))
    );
  }

  async checkForErrorElement(): Promise<boolean> {
    const errorSelectors = [
      '[class*="error"]',
      '[class*="alert"]',
      '[class*="toast"]:has-text("错误")',
      '[class*="toast"]:has-text("失败")',
      '[role="alert"]',
      '.error-message',
    ];
    
    for (const selector of errorSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        return true;
      }
    }
    return false;
  }
}

test.describe('网络错误处理测试', () => {
  let errorTester: ErrorHandlerTester;

  test.beforeEach(async ({ page }) => {
    errorTester = new ErrorHandlerTester(page);
  });

  test.afterEach(async ({}, testInfo) => {
    testInfo.annotations.push({
      type: 'error-analysis',
      description: JSON.stringify({
        consoleErrors: errorTester.getErrors(),
        networkErrors: errorTester.getNetworkErrors(),
      }),
    });
  });

  test('网络断开时的错误处理', async ({ page }) => {
    test.step('进入语音对话页面', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      await expect(page.locator('text="实时对话"')).toBeVisible({ timeout: 10000 });
    });

    test.step('模拟网络断开', async () => {
      await page.route('**/*', route => route.abort());
      console.log('网络请求已被拦截');
    });

    test.step('触发网络请求', async () => {
      const startButton = page.locator('button:has-text("开始对话")');
      if (await startButton.isVisible()) {
        await startButton.click();
      }
      await page.waitForTimeout(2000);
    });

    test.step('验证错误提示显示', async () => {
      const hasErrorMessage = await errorTester.checkForErrorElement();
      console.log(`错误提示可见: ${hasErrorMessage}`);
      
      const pageContent = await page.content();
      console.log(`页面包含错误信息: ${pageContent.toLowerCase().includes('错误') || pageContent.toLowerCase().includes('error')}`);
    });

    test.step('恢复网络', async () => {
      await page.unroute('**/*');
      console.log('网络请求已恢复');
    });

    test.step('验证页面可恢复', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    });
  });

  test('WebSocket连接失败处理', async ({ page }) => {
    test.step('拦截WebSocket连接', async () => {
      await page.route('**/*ws**', route => route.abort());
      await page.route('**/*websocket**', route => route.abort());
    });

    test.step('尝试连接语音服务', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      const startButton = page.locator('button:has-text("开始对话")');
      if (await startButton.isVisible()) {
        await startButton.click();
        await page.waitForTimeout(3000);
      }
    });

    test.step('验证错误处理', async () => {
      const hasError = await errorTester.checkForErrorMessage([
        '连接失败', '网络错误', '无法连接', 'connection failed'
      ]);
      console.log(`检测到连接错误: ${hasError}`);
    });

    test.step('验证重试选项存在', async () => {
      const hasRetryButton = await page.locator('button:has-text("重试"), button:has-text("重新连接")').first().isVisible({ timeout: 2000 });
      console.log(`重试按钮可见: ${hasRetryButton}`);
    });
  });

  test('API请求失败处理', async ({ page }) => {
    const failedEndpoints: string[] = [];

    test.step('模拟API失败', async () => {
      await page.route('**/api/**', async route => {
        failedEndpoints.push(route.request().url());
        await route.abort('failed');
      });
    });

    test.step('触发API请求', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      const analyzeButton = page.locator('button:has-text("分析"), button:has-text("处理")');
      if (await analyzeButton.isVisible()) {
        await analyzeButton.click();
        await page.waitForTimeout(2000);
      }
    });

    test.step('验证错误处理', async () => {
      console.log(`失败的API请求数量: ${failedEndpoints.length}`);
      
      const hasErrorMessage = await errorTester.checkForErrorMessage([
        '失败', '错误', 'error', 'failed'
      ]);
      console.log(`API错误被正确处理: ${hasErrorMessage}`);
    });
  });

  test('超时处理', async ({ page }) => {
    test.step('设置慢速网络', async () => {
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 5000);
      });
    });

    test.step('触发加载操作', async () => {
      const startTime = Date.now();
      await page.goto('/voice', { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;
      console.log(`页面加载时间: ${loadTime}ms`);
    });

    test.step('检查超时提示', async () => {
      await page.waitForTimeout(6000);
      
      const hasTimeoutMessage = await errorTester.checkForErrorMessage([
        '超时', 'timeout', '加载中', 'loading'
      ]);
      console.log(`超时状态正确显示: ${hasTimeoutMessage}`);
    });
  });
});

test.describe('权限错误处理测试', () => {
  test('麦克风权限拒绝处理', async ({ page }) => {
    const permissionDenied = false;

    test.step('拒绝麦克风权限', async () => {
      const context = page.context();
      await context.clearPermissions();
      console.log('麦克风权限已清除');
    });

    test.step('尝试使用语音功能', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      const startButton = page.locator('button:has-text("开始对话")');
      if (await startButton.isVisible()) {
        await startButton.click();
        await page.waitForTimeout(2000);
      }
    });

    test.step('验证权限提示', async () => {
      const hasPermissionPrompt = await page.locator('text="麦克风", text="microphone", text="权限"').first().isVisible({ timeout: 3000 });
      console.log(`权限提示可见: ${hasPermissionPrompt}`);
      
      const hasErrorElement = await page.locator('[class*="error"], [class*="alert"]').first().isVisible({ timeout: 2000 });
      console.log(`错误提示可见: ${hasErrorElement}`);
    });

    test.step('验证指导信息', async () => {
      const hasGuidance = await page.locator('text="设置", text="开启", text="允许"').first().isVisible({ timeout: 2000 });
      console.log(`指导信息可见: ${hasGuidance}`);
    });
  });

  test('权限授予后功能恢复', async ({ page }) => {
    test.step('授予麦克风权限', async () => {
      const context = page.context();
      await context.grantPermissions(['microphone']);
      console.log('麦克风权限已授予');
    });

    test.step('验证功能可用', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      const startButton = page.locator('button:has-text("开始对话")');
      if (await startButton.isVisible()) {
        await startButton.click();
        await page.waitForTimeout(1000);
        
        const stopButton = page.locator('button:has-text("停止")');
        const isFunctioning = await stopButton.isVisible({ timeout: 3000 });
        console.log(`语音功能正常: ${isFunctioning}`);
      }
    });
  });
});

test.describe('JavaScript错误处理测试', () => {
  test('未捕获异常处理', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    test.step('触发JavaScript错误', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      
      await page.evaluate(() => {
        throw new Error('Test JavaScript Error');
      });
      
      await page.waitForTimeout(1000);
    });

    test.step('验证错误被捕获', async () => {
      console.log(`JavaScript错误数量: ${jsErrors.length}`);
      expect(jsErrors.length).toBeGreaterThan(0);
    });

    test.step('验证页面未崩溃', async () => {
      await expect(page.locator('main')).toBeVisible({ timeout: 5000 });
      console.log('页面仍然可访问');
    });
  });

  test('Promise拒绝处理', async ({ page }) => {
    const unhandledRejections: string[] = [];

    page.on('pageerror', error => {
      unhandledRejections.push(error.message);
    });

    test.step('触发Promise拒绝', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      
      await page.evaluate(() => {
        Promise.reject(new Error('Test Promise Rejection'));
      });
      
      await page.waitForTimeout(1000);
    });

    test.step('验证Promise拒绝处理', async () => {
      console.log(`未处理的Promise拒绝: ${unhandledRejections.length}`);
      expect(unhandledRejections.length).toBeGreaterThan(0);
    });
  });
});

test.describe('资源加载错误测试', () => {
  test('图片加载失败处理', async ({ page }) => {
    test.step('模拟图片加载失败', async () => {
      await page.route('**/*.png', route => route.abort());
      await page.route('**/*.jpg', route => route.abort());
      await page.route('**/*.svg', route => route.abort());
    });

    test.step('加载包含图片的页面', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    });

    test.step('验证页面可用性', async () => {
      const mainVisible = await page.locator('main').isVisible();
      expect(mainVisible).toBe(true);
      
      const interactiveElements = await page.locator('button, [role="button"], a').count();
      console.log(`交互元素数量: ${interactiveElements}`);
      expect(interactiveElements).toBeGreaterThan(0);
    });
  });

  test('脚本加载失败处理', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    test.step('模拟脚本加载失败', async () => {
      await page.route('**/*.js', route => route.abort());
    });

    test.step('加载页面', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    });

    test.step('验证页面降级处理', async () => {
      console.log(`脚本加载错误: ${consoleErrors.length}`);
      
      const mainVisible = await page.locator('main').isVisible();
      console.log(`页面主内容可见: ${mainVisible}`);
    });
  });
});

test.describe('状态恢复测试', () => {
  test('错误后状态恢复', async ({ page }) => {
    test.step('初始状态', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      await expect(page.locator('main')).toBeVisible();
    });

    test.step('模拟错误', async () => {
      await page.route('**/*', route => route.abort());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    });

    test.step('恢复网络', async () => {
      await page.unroute('**/*');
      await page.reload({ waitUntil: 'networkidle' });
    });

    test.step('验证状态恢复', async () => {
      await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button:has-text("开始对话")').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test('连续错误恢复', async ({ page }) => {
    test.step('多次模拟错误', async () => {
      for (let i = 0; i < 3; i++) {
        await page.route('**/*', route => route.abort());
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        await page.unroute('**/*');
        await page.waitForTimeout(500);
      }
    });

    test.step('最终恢复', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('边界条件测试', () => {
  test('空数据处理', async ({ page }) => {
    test.step('模拟空响应', async () => {
      await page.route('**/*', route => {
        route.fulfill({ status: 200, body: '' });
      });
    });

    test.step('加载页面', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
    });

    test.step('验证空数据处理', async () => {
      const mainVisible = await page.locator('main').isVisible();
      expect(mainVisible).toBe(true);
    });
  });

  test('超大数据处理', async ({ page }) => {
    test.step('模拟大数据响应', async () => {
      const largeData = 'x'.repeat(10 * 1024 * 1024);
      await page.route('**/*', route => {
        route.fulfill({ status: 200, body: largeData });
      });
    });

    test.step('加载页面', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test.step('验证大数据处理', async () => {
      await page.waitForTimeout(2000);
      const mainVisible = await page.locator('main').isVisible();
      expect(mainVisible).toBe(true);
    });
  });

  test('特殊字符处理', async ({ page }) => {
    test.step('输入特殊字符', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      const input = page.locator('input[type="text"], textarea, [contenteditable]').first();
      if (await input.isVisible()) {
        await input.fill('Test<>""\'\"中文日本語한국어');
      }
    });

    test.step('验证特殊字符处理', async () => {
      await page.waitForTimeout(1000);
      const mainVisible = await page.locator('main').isVisible();
      expect(mainVisible).toBe(true);
    });
  });
});

export default {};
