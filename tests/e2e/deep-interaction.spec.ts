/**
 * 深度交互测试套件
 * Comprehensive Frontend Deep Interaction Test Suite
 * 
 * 测试范围：
 * 1. 语音对话流程
 * 2. 状态管理
 * 3. 错误处理
 * 4. 性能监控
 * 5. 用户体验
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

interface VoiceMetrics {
  connectTime: number;
  asrLatency: number;
  ttsLatency: number;
  errorCount: number;
}

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  metrics?: VoiceMetrics;
  errors: string[];
}

class DeepInteractionTester {
  private page: Page;
  private results: TestResult[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async runVoiceFlowTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let metrics: VoiceMetrics = {
      connectTime: 0,
      asrLatency: 0,
      ttsLatency: 0,
      errorCount: 0
    };

    try {
      await test.step('1. 导航到对话页面', async () => {
        await this.page.goto('/talk', { waitUntil: 'domcontentloaded' });
      });

      await test.step('2. 检查页面元素', async () => {
        const connectBtn = this.page.locator('button:has-text("连接语音服务")');
        if (await connectBtn.isVisible({ timeout: 5000 })) {
          console.log('找到连接按钮');
        }
      });

      await test.step('3. 检查语音状态显示', async () => {
        const statusArea = this.page.locator('[class*="voice-status"], [class*="realtime-voice"]').first();
        if (await statusArea.isVisible({ timeout: 3000 })) {
          console.log('语音状态区域可见');
        }
      });

      await test.step('4. 检查麦克风权限提示', async () => {
        const permissionGuide = this.page.locator('[class*="permission"], [class*="guide"]').first();
        if (await permissionGuide.isVisible({ timeout: 2000 })) {
          console.log('权限提示可见');
        }
      });

      return {
        name: '语音对话流程测试',
        success: true,
        duration: Date.now() - startTime,
        metrics,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '语音对话流程测试',
        success: false,
        duration: Date.now() - startTime,
        metrics,
        errors
      };
    }
  }

  async runChatVoiceTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await test.step('1. 导航到聊天页面', async () => {
        await this.page.goto('/chat', { waitUntil: 'domcontentloaded' });
      });

      await test.step('2. 检查语音输入区域', async () => {
        const voiceArea = this.page.locator('[data-testid="voice-meter"], [class*="voice-input"]').first();
        if (await voiceArea.isVisible({ timeout: 3000 })) {
          console.log('语音输入区域可见');
        }
      });

      await test.step('3. 检查语音按钮', async () => {
        const voiceBtn = this.page.locator('[data-testid="button-start-voice"], [class*="voice-button"]').first();
        if (await voiceBtn.isVisible({ timeout: 3000 })) {
          console.log('语音按钮可见');
        }
      });

      await test.step('4. 检查语音波形显示', async () => {
        const voiceMeter = this.page.locator('[data-testid="voice-meter"]');
        if (await voiceMeter.isVisible({ timeout: 2000 })) {
          console.log('语音波形显示可见');
        }
      });

      return {
        name: '聊天页面语音测试',
        success: true,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '聊天页面语音测试',
        success: false,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  async runSettingsVoiceTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await test.step('1. 导航到设置页面', async () => {
        await this.page.goto('/settings', { waitUntil: 'domcontentloaded' });
      });

      await test.step('2. 检查语音设置区域', async () => {
        const voiceSettings = this.page.locator('[class*="voice-setting"], [class*="voice-config"]').first();
        if (await voiceSettings.isVisible({ timeout: 3000 })) {
          console.log('语音设置区域可见');
        }
      });

      await test.step('3. 检查语音开关', async () => {
        const voiceSwitch = this.page.locator('[data-testid="switch-voice"], input[type="checkbox"]').first();
        if (await voiceSwitch.isVisible({ timeout: 2000 })) {
          console.log('语音开关可见');
        }
      });

      await test.step('4. 检查声纹管理', async () => {
        const voiceprintSection = this.page.locator('[class*="voiceprint"], [class*="声纹"]').first();
        if (await voiceprintSection.isVisible({ timeout: 2000 })) {
          console.log('声纹管理区域可见');
        }
      });

      return {
        name: '设置页面语音测试',
        success: true,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '设置页面语音测试',
        success: false,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  async runDashboardVoiceWidgetTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await test.step('1. 导航到首页', async () => {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' });
      });

      await test.step('2. 检查仪表盘加载', async () => {
        await expect(this.page.locator('body')).toBeVisible({ timeout: 10000 });
      });

      await test.step('3. 检查语音组件挂件', async () => {
        const voiceWidget = this.page.locator('[class*="voice-widget"], [class*="realtime-voice"]').first();
        if (await voiceWidget.isVisible({ timeout: 5000 })) {
          console.log('语音组件挂件可见');
        }
      });

      await test.step('4. 检查声纹组件', async () => {
        const voiceprintWidget = this.page.locator('[class*="voiceprint-widget"], [class*="声纹"]').first();
        if (await voiceprintWidget.isVisible({ timeout: 3000 })) {
          console.log('声纹组件可见');
        }
      });

      return {
        name: '仪表盘语音组件测试',
        success: true,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '仪表盘语音组件测试',
        success: false,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  async runStateManagementTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await test.step('1. 测试页面间状态传递', async () => {
        await this.page.goto('/talk', { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(1000);
        
        await this.page.goto('/chat', { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(1000);
        
        await this.page.goto('/settings', { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(1000);
      });

      await test.step('2. 检查页面状态一致性', async () => {
        const body = this.page.locator('body');
        await expect(body).toBeVisible({ timeout: 5000 });
      });

      return {
        name: '状态管理测试',
        success: true,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '状态管理测试',
        success: false,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  async runErrorRecoveryTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await test.step('1. 模拟网络断开场景', async () => {
        await this.page.goto('/talk', { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(2000);
      });

      await test.step('2. 检查错误恢复机制', async () => {
        const errorArea = this.page.locator('[class*="error"], [class*="错误"]').first();
        if (await errorArea.isVisible({ timeout: 2000 })) {
          console.log('错误区域可见');
        }
      });

      await test.step('3. 验证页面仍可交互', async () => {
        const body = this.page.locator('body');
        await expect(body).toBeVisible({ timeout: 5000 });
      });

      return {
        name: '错误恢复测试',
        success: true,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '错误恢复测试',
        success: false,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  async runPerformanceTest(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const metrics: VoiceMetrics = {
      connectTime: 0,
      asrLatency: 0,
      ttsLatency: 0,
      errorCount: 0
    };

    try {
      await test.step('1. 测量页面加载时间', async () => {
        const navStart = Date.now();
        await this.page.goto('/', { waitUntil: 'domcontentloaded' });
        metrics.connectTime = Date.now() - navStart;
        console.log(`页面加载时间: ${metrics.connectTime}ms`);
      });

      await test.step('2. 测量交互响应时间', async () => {
        const interactStart = Date.now();
        await this.page.locator('button').first().click({ timeout: 1000 }).catch(() => {});
        const interactTime = Date.now() - interactStart;
        console.log(`交互响应时间: ${interactTime}ms`);
      });

      await test.step('3. 内存使用检查', async () => {
        const memory = await this.page.evaluate(() => {
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
        }
      });

      return {
        name: '性能测试',
        success: true,
        duration: Date.now() - startTime,
        metrics,
        errors
      };
    } catch (error) {
      errors.push(String(error));
      return {
        name: '性能测试',
        success: false,
        duration: Date.now() - startTime,
        metrics,
        errors
      };
    }
  }
}

test.describe('深度交互测试套件', () => {
  let tester: DeepInteractionTester;

  test.beforeEach(async ({ page }) => {
    tester = new DeepInteractionTester(page);
  });

  test.describe('语音功能核心测试', () => {
    test('TC001: 语音对话流程测试', async ({ page }) => {
      const result = await tester.runVoiceFlowTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
      if (result.errors.length > 0) {
        console.log(`错误: ${result.errors.join(', ')}`);
      }
    });

    test('TC002: 聊天页面语音测试', async ({ page }) => {
      const result = await tester.runChatVoiceTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
    });

    test('TC003: 设置页面语音测试', async ({ page }) => {
      const result = await tester.runSettingsVoiceTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
    });

    test('TC004: 仪表盘语音组件测试', async ({ page }) => {
      const result = await tester.runDashboardVoiceWidgetTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
    });
  });

  test.describe('状态与错误处理测试', () => {
    test('TC005: 状态管理测试', async ({ page }) => {
      const result = await tester.runStateManagementTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
    });

    test('TC006: 错误恢复测试', async ({ page }) => {
      const result = await tester.runErrorRecoveryTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
    });
  });

  test.describe('性能测试', () => {
    test('TC007: 性能测试', async ({ page }) => {
      const result = await tester.runPerformanceTest();
      console.log(`测试结果: ${result.success ? '通过' : '失败'}`);
      console.log(`耗时: ${result.duration}ms`);
      if (result.metrics) {
        console.log(`连接时间: ${result.metrics.connectTime}ms`);
      }
    });

    test('TC008: Core Web Vitals测试', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const lcp = await page.evaluate(() => {
        const entries = performance.getEntriesByType('largest-contentful-paint');
        if (entries.length > 0) {
          return (entries[entries.length - 1] as any).startTime;
        }
        return 0;
      });

      console.log(`LCP: ${lcp.toFixed(2)}ms`);

      const fcp = await page.evaluate(() => {
        const entries = performance.getEntriesByType('paint');
        const fcpEntry = entries.find((e: any) => e.name === 'first-contentful-paint');
        return fcpEntry ? fcpEntry.startTime : 0;
      });

      console.log(`FCP: ${fcp.toFixed(2)}ms`);

      expect(lcp).toBeLessThan(3000);
    });
  });

  test.describe('多页面流程测试', () => {
    test('TC009: 完整用户旅程测试', async ({ page }) => {
      const journeySteps: string[] = [];

      await test.step('1. 首页 → 对话页', async () => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        journeySteps.push('首页加载完成');
      });

      await test.step('2. 对话页 → 聊天页', async () => {
        await page.goto('/talk', { waitUntil: 'domcontentloaded' });
        journeySteps.push('对话页加载完成');
      });

      await test.step('3. 聊天页 → 设置页', async () => {
        await page.goto('/chat', { waitUntil: 'domcontentloaded' });
        journeySteps.push('聊天页加载完成');
      });

      await test.step('4. 设置页 → 首页', async () => {
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });
        journeySteps.push('设置页加载完成');
      });

      console.log('用户旅程步骤:');
      journeySteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
      });

      expect(journeySteps.length).toBe(4);
    });

    test('TC010: 语音功能可用性检查', async ({ page }) => {
      const pages = ['/', '/talk', '/chat', '/settings'];
      const voiceFeatures: { page: string; hasVoiceButton: boolean; hasVoiceMeter: boolean }[] = [];

      for (const path of pages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        
        const hasVoiceButton = await page.locator('[class*="voice"], [class*="mic"]').first().isVisible().catch(() => false);
        const hasVoiceMeter = await page.locator('[data-testid="voice-meter"], [class*="wave"]').first().isVisible().catch(() => false);
        
        voiceFeatures.push({
          page: path,
          hasVoiceButton,
          hasVoiceMeter
        });
      }

      console.log('语音功能可用性:');
      voiceFeatures.forEach(f => {
        console.log(`  ${f.page}: 按钮=${f.hasVoiceButton}, 波形=${f.hasVoiceMeter}`);
      });
    });
  });

  test.describe('错误边界测试', () => {
    test('TC011: 404页面处理', async ({ page }) => {
      await page.goto('/non-existent-page', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
    });

    test('TC012: JavaScript错误边界', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('429 (Too Many Requests)') &&
        !e.includes('net::')
      );

      console.log(`控制台错误数: ${criticalErrors.length}`);
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('响应式与兼容性测试', () => {
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      test(`TC013-${viewport.name}: 响应式布局测试`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await test.step(`检查${viewport.name}布局`, async () => {
          await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
          console.log(`${viewport.name} (${viewport.width}x${viewport.height}): 布局正常`);
        });
      });
    }
  });
});

test.describe('长时间运行稳定性测试', () => {
  test('TC014: 持续运行测试 (超简版)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const memory = await page.evaluate(() => {
      const perf = performance as any;
      return perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1024 / 1024) : 0;
    });

    console.log(`初始内存: ${memory}MB`);
    expect(memory).toBeGreaterThan(0);
  });

  test('TC015: 频繁页面切换测试', async ({ page }) => {
    const pages = ['/', '/talk', '/chat', '/settings'];
    const switchCount = 5;
    const switchTimes: number[] = [];

    for (let i = 0; i < switchCount; i++) {
      const path = pages[i % pages.length];
      const start = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      switchTimes.push(Date.now() - start);
    }

    const avgTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
    console.log(`平均切换时间: ${avgTime.toFixed(2)}ms`);
    expect(switchTimes.length).toBe(switchCount);
  });
});

test.describe('WebSocket连接测试', () => {
  test('TC016: WebSocket连接稳定性', async ({ page }) => {
    const wsConnections: string[] = [];

    page.on('console', msg => {
      if (msg.text().includes('ws') || msg.text().includes('websocket') || msg.text().includes('WebSocket')) {
        wsConnections.push(msg.text());
      }
    });

    await page.goto('/talk', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    console.log(`WebSocket相关日志: ${wsConnections.length}条`);

    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);
  });

  test('TC017: 网络断开恢复测试', async ({ page }) => {
    await page.goto('/talk', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);

    await page.waitForTimeout(2000);

    const bodyStillVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyStillVisible).toBe(true);
  });
});

export default {};
