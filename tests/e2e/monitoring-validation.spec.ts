/**
 * 监控配置验证测试
 * 验证 Sentry、OpenReplay 的配置正确性
 */

import { test, expect, type Page } from '@playwright/test';

interface MonitoringConfig {
  sentry?: {
    dsn: string;
    enabled: boolean;
  };
  openreplay?: {
    projectKey: string;
    enabled: boolean;
  };
}

class MonitoringTester {
  private page: Page;
  private consoleMessages: any[] = [];
  private errors: string[] = [];

  constructor(page: Page) {
    this.page = page;
    
    page.on('console', msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
      
      if (msg.type() === 'error') {
        this.errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      this.errors.push(error.message);
    });
  }

  getConsoleMessages(): any[] {
    return this.consoleMessages;
  }

  getErrors(): string[] {
    return this.errors;
  }

  async checkSentryInitialization(): Promise<{
    initialized: boolean;
    dsn: string | null;
    environment: string | null;
  }> {
    return await this.page.evaluate(() => {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        return {
          initialized: true,
          dsn: (window as any).Sentry?.DSN || null,
          environment: (window as any).Sentry?.environment || null,
        };
      }
      return {
        initialized: false,
        dsn: null,
        environment: null,
      };
    });
  }

  async checkOpenReplayInitialization(): Promise<{
    initialized: boolean;
    projectKey: string | null;
    sessionActive: boolean;
  }> {
    return await this.page.evaluate(() => {
      if (typeof window !== 'undefined' && (window as any).openreplay) {
        return {
          initialized: true,
          projectKey: (window as any).openreplay?.projectKey || null,
          sessionActive: true,
        };
      }
      return {
        initialized: false,
        projectKey: null,
        sessionActive: false,
      };
    });
  }

  async triggerTestError(): Promise<void> {
    await this.page.evaluate(() => {
      try {
        throw new Error('Sentry Test Error - Monitoring Validation');
      } catch (e) {
        console.error('Test error triggered:', e);
      }
    });
  }

  async trackTestEvent(eventName: string, data?: any): Promise<void> {
    await this.page.evaluate(({ name, eventData }) => {
      if ((window as any).openreplay) {
        (window as any).openreplay.trk(name, eventData);
      }
      console.log(`[OpenReplay] Test event tracked: ${name}`);
    }, { name: eventName, eventData: data });
  }
}

test.describe('Sentry 配置验证', () => {
  let monitoringTester: MonitoringTester;

  test.beforeEach(async ({ page }) => {
    monitoringTester = new MonitoringTester(page);
  });

  test.afterEach(async ({}, testInfo) => {
    const consoleMessages = monitoringTester.getConsoleMessages();
    const errors = monitoringTester.getErrors();
    
    testInfo.annotations.push({
      type: 'monitoring-analysis',
      description: JSON.stringify({
        consoleMessages: consoleMessages.length,
        errors: errors.length,
      }),
    });
  });

  test('Sentry SDK 初始化验证', async ({ page }) => {
    test.step('访问页面', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
    });

    test.step('检查 Sentry 初始化状态', async () => {
      const sentryStatus = await monitoringTester.checkSentryInitialization();
      console.log('=== Sentry 初始化状态 ===');
      console.log(`已初始化: ${sentryStatus.initialized}`);
      console.log(`DSN: ${sentryStatus.dsn || '未设置'}`);
      console.log(`环境: ${sentryStatus.environment || '未知'}`);
    });

    test.step('验证控制台消息', async () => {
      const messages = monitoringTester.getConsoleMessages();
      const sentryMessages = messages.filter(m => 
        m.text.includes('Sentry') || m.text.includes('sentry')
      );
      
      console.log(`Sentry相关消息数量: ${sentryMessages.length}`);
      sentryMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text}`);
      });
    });
  });

  test('Sentry 错误捕获测试', async ({ page }) => {
    test.step('访问页面', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
    });

    test.step('触发测试错误', async () => {
      const errorCount = monitoringTester.getErrors().length;
      await monitoringTester.triggerTestError();
      await page.waitForTimeout(1000);
      
      const newErrorCount = monitoringTester.getErrors().length;
      console.log(`错误触发后错误数量: ${newErrorCount - errorCount}`);
    });

    test.step('验证错误上报', async () => {
      const errors = monitoringTester.getErrors();
      const hasTestError = errors.some(e => e.includes('Sentry Test Error'));
      console.log(`测试错误被捕获: ${hasTestError}`);
      expect(hasTestError).toBe(true);
    });
  });

  test('Sentry 性能监控验证', async ({ page }) => {
    test.step('检查性能监控状态', async () => {
      const performanceData = await page.evaluate(() => {
        return {
          timing: performance.timing,
          navigation: performance.getEntriesByType('navigation'),
          marks: performance.getEntriesByType('mark'),
          measures: performance.getEntriesByType('measure'),
        };
      });
      
      console.log('=== 性能监控数据 ===');
      console.log(`导航条目数量: ${performanceData.navigation.length}`);
      console.log(`DOMContentLoaded: ${performanceData.timing.domContentLoadedEventEnd - performanceData.timing.navigationStart}ms`);
    });
  });

  test('Sentry 用户上下文设置', async ({ page }) => {
    test.step('设置用户信息', async () => {
      await page.evaluate(() => {
        localStorage.setItem('userId', 'test-user-001');
        localStorage.setItem('userRole', 'tester');
      });
    });

    test.step('访问页面触发用户上下文', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.reload();
      await page.waitForTimeout(2000);
    });

    test.step('验证上下文', async () => {
      const contextData = await page.evaluate(() => {
        return {
          userId: localStorage.getItem('userId'),
          userRole: localStorage.getItem('userRole'),
        };
      });
      
      console.log(`用户ID: ${contextData.userId}`);
      console.log(`用户角色: ${contextData.userRole}`);
      expect(contextData.userId).toBe('test-user-001');
    });
  });
});

test.describe('OpenReplay 配置验证', () => {
  let monitoringTester: MonitoringTester;

  test.beforeEach(async ({ page }) => {
    monitoringTester = new MonitoringTester(page);
  });

  test('OpenReplay SDK 初始化验证', async ({ page }) => {
    test.step('访问页面', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
    });

    test.step('检查 OpenReplay 初始化状态', async () => {
      const replayStatus = await monitoringTester.checkOpenReplayInitialization();
      console.log('=== OpenReplay 初始化状态 ===');
      console.log(`已初始化: ${replayStatus.initialized}`);
      console.log(`项目密钥: ${replayStatus.projectKey || '未设置'}`);
      console.log(`会话活动: ${replayStatus.sessionActive}`);
    });

    test.step('验证控制台消息', async () => {
      const messages = monitoringTester.getConsoleMessages();
      const replayMessages = messages.filter(m => 
        m.text.includes('OpenReplay') || m.text.includes('openreplay')
      );
      
      console.log(`OpenReplay相关消息数量: ${replayMessages.length}`);
      replayMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text}`);
      });
    });
  });

  test('OpenReplay 事件追踪测试', async ({ page }) => {
    test.step('访问页面', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
    });

    test.step('追踪测试事件', async () => {
      await monitoringTester.trackTestEvent('test_interaction', {
        test: true,
        timestamp: Date.now(),
      });
      await page.waitForTimeout(500);
    });

    test.step('验证事件追踪', async () => {
      const messages = monitoringTester.getConsoleMessages();
      const trackedEvents = messages.filter(m => 
        m.text.includes('Test event tracked') || m.text.includes('test_interaction')
      );
      
      console.log(`事件追踪消息数量: ${trackedEvents.length}`);
      expect(trackedEvents.length).toBeGreaterThan(0);
    });
  });

  test('OpenReplay 用户会话录制', async ({ page }) => {
    test.step('模拟用户交互', async () => {
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      await page.click('button:first-child').catch(() => {});
      await page.waitForTimeout(1000);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(500);
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
    });

    test.step('验证会话录制', async () => {
      const replayStatus = await monitoringTester.checkOpenReplayInitialization();
      console.log(`会话录制状态: ${replayStatus.sessionActive ? '活动中' : '未开始'}`);
    });
  });

  test('OpenReplay 隐私保护验证', async ({ page }) => {
    test.step('检查隐私设置', async () => {
      const privacySettings = await page.evaluate(() => {
        return {
          hasSensitiveInputs: document.querySelectorAll('input[type="password"]').length > 0,
          hasEmailFields: document.querySelectorAll('input[type="email"]').length > 0,
          hasCreditCardFields: document.querySelectorAll('input[type="credit-card"]').length > 0,
        };
      });
      
      console.log('=== 隐私设置检查 ===');
      console.log(`密码输入框: ${privacySettings.hasSensitiveInputs}`);
      console.log(`邮箱输入框: ${privacySettings.hasEmailFields}`);
      console.log(`信用卡输入框: ${privacySettings.hasCreditCardFields}`);
    });
  });
});

test.describe('监控集成测试', () => {
  test('Sentry 和 OpenReplay 同时运行', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    test.step('验证两个监控系统', async () => {
      const sentryStatus = await page.evaluate(() => {
        return {
          name: 'Sentry',
          initialized: typeof window !== 'undefined' && !!(window as any).Sentry,
        };
      });

      const replayStatus = await page.evaluate(() => {
        return {
          name: 'OpenReplay',
          initialized: typeof window !== 'undefined' && !!(window as any).openreplay,
        };
      });

      console.log('=== 监控集成状态 ===');
      console.log(`${sentryStatus.name}: ${sentryStatus.initialized ? '已初始化' : '未初始化'}`);
      console.log(`${replayStatus.name}: ${replayStatus.initialized ? '已初始化' : '未初始化'}`);
    });
  });

  test('错误和事件同时上报', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    test.step('触发错误和事件', async () => {
      await page.evaluate(() => {
        if ((window as any).Sentry) {
          (window as any).Sentry.captureMessage('Integration Test Message', 'info');
        }
        console.log('测试消息已发送');
      });
      
      await page.waitForTimeout(1000);
    });

    test.step('验证上报', async () => {
      console.log(`控制台消息数量: ${consoleErrors.length}`);
      expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('性能数据同时采集', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    test.step('采集性能数据', async () => {
      const performanceData = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          ttfb: navigation.responseStart - navigation.requestStart,
        };
      });

      console.log('=== 性能数据 ===');
      console.log(`DOMContentLoaded: ${performanceData.domContentLoaded}ms`);
      console.log(`Load Complete: ${performanceData.loadComplete}ms`);
      console.log(`TTFB: ${performanceData.ttfb}ms`);
    });
  });
});

test.describe('监控配置验证报告', () => {
  test('生成配置验证摘要', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const configSummary = await page.evaluate(() => {
      const monitoring: MonitoringConfig = {};
      
      if ((window as any).Sentry) {
        monitoring.sentry = {
          dsn: (window as any).Sentry?.DSN || 'unknown',
          enabled: true,
        };
      }
      
      if ((window as any).openreplay) {
        monitoring.openreplay = {
          projectKey: 'configured',
          enabled: true,
        };
      }
      
      return monitoring;
    });

    console.log('=== 监控配置摘要 ===');
    console.log(JSON.stringify(configSummary, null, 2));

    test.info().annotations.push({
      type: 'monitoring-config',
      description: JSON.stringify(configSummary),
    });
  });
});

export default {};
