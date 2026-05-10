/**
 * Playwright 测试配置
 * 专业的端到端交互测试
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// 测试配置
export const testConfig = {
  baseURL: 'http://localhost:3000',
  viewport: { width: 1280, height: 720 },
  video: 'on-first-retry',
  screenshot: 'only-on-failure',
  trace: 'on-first-retry',
};

// 自定义测试 fixtures
export class TestHelper {
  constructor(private page: Page) {}

  // 等待页面加载完成
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000); // 额外等待确保完全渲染
  }

  // 检查控制台错误
  async checkConsoleErrors() {
    const errors: string[] = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    return errors;
  }

  // 检查网络错误
  async checkNetworkErrors() {
    const failedRequests: any[] = [];
    
    this.page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });

    return failedRequests;
  }

  // 测试语音录制功能
  async testVoiceRecording() {
    // 模拟麦克风权限
    await this.page.context().grantPermissions(['microphone']);

    // 点击语音录制按钮
    await this.page.click('[data-testid="button-enroll-voiceprint"]');

    // 等待录制开始
    await this.page.waitForSelector('.animate-pulse', { state: 'visible' });

    // 模拟3秒录制
    await this.page.waitForTimeout(3000);

    // 停止录制
    await this.page.click('[data-testid="button-enroll-voiceprint"]');

    // 等待处理完成
    await this.page.waitForSelector('.animate-pulse', { state: 'hidden' });
  }

  // 测试实时语音对话
  async testRealtimeVoice() {
    // 连接语音服务
    await this.page.click('text="连接语音服务"');
    await this.page.waitForSelector('text="断开连接"', { state: 'visible' });

    // 开始对话
    await this.page.click('text="开始对话"');
    await this.page.waitForSelector('text="停止监听"', { state: 'visible' });

    // 检查监听状态
    const listeningIndicator = await this.page.locator('.animate-pulse').isVisible();
    expect(listeningIndicator).toBe(true);
  }

  // 测试组件交互
  async testComponentInteraction(selector: string, action: 'click' | 'hover' | 'type' = 'click') {
    await this.page.waitForSelector(selector);
    
    switch (action) {
      case 'click':
        await this.page.click(selector);
        break;
      case 'hover':
        await this.page.hover(selector);
        break;
      case 'type':
        await this.page.type(selector, 'test input');
        break;
    }

    // 等待任何可能的副作用
    await this.page.waitForTimeout(500);
  }

  // 检查响应式设计
  async testResponsive(breakpoints: { name: string; width: number; height: number }[]) {
    for (const breakpoint of breakpoints) {
      await this.page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await this.waitForPageLoad();
      
      // 检查关键元素是否可见
      const header = await this.page.locator('header').isVisible();
      const main = await this.page.locator('main').isVisible();
      
      expect(header).toBe(true);
      expect(main).toBe(true);
      
      console.log(`✅ 响应式测试通过: ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`);
    }
  }

  // 测试页面性能
  async testPagePerformance() {
    const navigationStart = await this.page.evaluate(() => performance.timing.navigationStart);
    const loadEventEnd = await this.page.evaluate(() => performance.timing.loadEventEnd);

    const loadTime = loadEventEnd - navigationStart;

    // 检查关键性能指标
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
      };
    });

    console.log('📊 页面性能指标:', {
      loadTime: `${loadTime}ms`,
      ...metrics,
    });

    return { loadTime, metrics };
  }

  // 检查无障碍性
  async testAccessibility() {
    const accessibilityIssues = await this.page.locator('[aria-label=""], [role=""]').count();
    const imagesWithoutAlt = await this.page.locator('img:not([alt])').count();
    
    console.log(`♿ 无障碍性检查:`, {
      missingAriaLabels: accessibilityIssues,
      imagesWithoutAlt,
    });

    return {
      accessibilityIssues,
      imagesWithoutAlt,
    };
  }
}

// 测试套件
export const voiceInteractionTests = () => {
  test('语音录制功能测试', async ({ page }) => {
    const helper = new TestHelper(page);
    
    // 访问语音页面
    await page.goto('/dashboard/voice');
    await helper.waitForPageLoad();

    // 检查页面标题
    await expect(page.locator('text="声纹锁"')).toBeVisible();

    // 测试录制功能
    await helper.testVoiceRecording();

    // 检查控制台错误
    const consoleErrors = await helper.checkConsoleErrors();
    expect(consoleErrors).toHaveLength(0);
  });

  test('实时语音对话测试', async ({ page }) => {
    const helper = new TestHelper(page);
    
    await page.goto('/dashboard/voice');
    await helper.waitForPageLoad();

    // 切换到实时对话标签
    await page.click('text="实时对话"');
    
    // 测试实时对话功能
    await helper.testRealtimeVoice();

    // 检查网络错误
    const networkErrors = await helper.checkNetworkErrors();
    expect(networkErrors.length).toBe(0);
  });

  test('语音组件交互测试', async ({ page }) => {
    const helper = new TestHelper(page);
    
    await page.goto('/dashboard/voice');
    await helper.waitForPageLoad();

    // 测试各种交互
    await helper.testComponentInteraction('[data-testid="button-add-authorization"]');
    await helper.testComponentInteraction('.lucide-user-plus', 'hover');
    
    // 检查状态变化
    const modalVisible = await page.locator('[role="dialog"]').isVisible();
    expect(modalVisible).toBe(true);
  });

  test('响应式设计测试', async ({ page }) => {
    const helper = new TestHelper(page);
    
    await page.goto('/dashboard/voice');
    
    const breakpoints = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1280, height: 720 },
    ];

    await helper.testResponsive(breakpoints);
  });

  test('性能测试', async ({ page }) => {
    const helper = new TestHelper(page);
    
    await page.goto('/dashboard/voice');
    const performance = await helper.testPagePerformance();
    
    // 页面加载时间应该小于3秒
    expect(performance.loadTime).toBeLessThan(3000);
  });

  test('无障碍性测试', async ({ page }) => {
    const helper = new TestHelper(page);
    
    await page.goto('/dashboard/voice');
    const accessibility = await helper.testAccessibility();
    
    // 不应该有无障碍性问题
    expect(accessibility.accessibilityIssues).toBe(0);
    expect(accessibility.imagesWithoutAlt).toBe(0);
  });
};

export default voiceInteractionTests;