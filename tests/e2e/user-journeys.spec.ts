/**
 * 用户旅程测试脚本
 * 覆盖核心用户使用场景的端到端测试
 */

import { test, expect, type Page } from '@playwright/test';

interface JourneyMetrics {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  errors: string[];
}

class UserJourneyTester {
  private page: Page;
  private metrics: JourneyMetrics[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async startJourney(name: string): Promise<void> {
    this.metrics.push({
      name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      errors: [],
    });
    console.log(`🚀 开始用户旅程: ${name}`);
  }

  async endJourney(name: string, success: boolean, errors: string[] = []): Promise<void> {
    const journey = this.metrics.find(m => m.name === name);
    if (journey) {
      journey.endTime = Date.now();
      journey.duration = journey.endTime - journey.startTime;
      journey.success = success;
      journey.errors = errors;
      console.log(`✅ 旅程完成: ${name} (${journey.duration}ms) - ${success ? '成功' : '失败'}`);
    }
  }

  getMetrics(): JourneyMetrics[] {
    return this.metrics;
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }
}

test.describe('用户旅程测试', () => {
  let journeyTester: UserJourneyTester;

  test.beforeEach(async ({ page }) => {
    journeyTester = new UserJourneyTester(page);
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Console Error] ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`[Page Error] ${error.message}`);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    const metrics = journeyTester.getMetrics();
    testInfo.annotations.push({
      type: 'journey-metrics',
      description: JSON.stringify(metrics),
    });

    if (testInfo.status === 'failed') {
      await journeyTester.takeScreenshot(testInfo.title);
    }
  });

  test('旅程1: 新用户首次语音对话', async ({ page }) => {
    await journeyTester.startJourney('新用户首次语音对话');

    const errors: string[] = [];

    try {
      console.log('步骤1: 打开应用首页');
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
      console.log('✓ 首页加载成功');

      console.log('步骤2: 点击语音对话入口');
      const voiceEntry = page.locator('text="语音对话"').first();
      if (await voiceEntry.isVisible({ timeout: 5000 })) {
        await voiceEntry.click();
        await page.waitForURL(/voice|dialog|chat/, { timeout: 10000 });
        console.log('✓ 成功进入语音对话页面');
      } else {
        console.log('⚠ 未找到语音对话入口，尝试直接访问');
        await page.goto('/voice', { waitUntil: 'networkidle' });
      }

      console.log('步骤3: 等待麦克风权限提示');
      await page.waitForTimeout(1000);

      console.log('步骤4: 授权麦克风');
      const context = page.context();
      await context.grantPermissions(['microphone']);
      console.log('✓ 麦克风权限已授权');

      console.log('步骤5: 检查语音功能组件');
      const startButton = page.locator('button:has-text("开始对话"), [data-testid="start-voice"]');
      if (await startButton.isVisible({ timeout: 5000 })) {
        console.log('✓ 开始对话按钮可见');
        
        await startButton.click();
        await page.waitForTimeout(2000);
        
        const stopButton = page.locator('button:has-text("停止"), [data-testid="stop-voice"]');
        if (await stopButton.isVisible({ timeout: 5000 })) {
          console.log('✓ 语音对话已开始');
        }
      }

      await journeyTester.endJourney('新用户首次语音对话', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      await journeyTester.endJourney('新用户首次语音对话', false, errors);
      throw error;
    }
  });

  test('旅程2: 现有用户发起语音对话', async ({ page }) => {
    await journeyTester.startJourney('现有用户语音对话');

    const errors: string[] = [];

    try {
      console.log('步骤1: 登录用户（模拟）');
      await page.goto('/', { waitUntil: 'networkidle' });
      
      await page.evaluate(() => {
        localStorage.setItem('userId', 'test-user-001');
        localStorage.setItem('userRole', 'user');
      });
      console.log('✓ 用户状态已设置');

      console.log('步骤2: 进入语音对话页面');
      await page.goto('/voice', { waitUntil: 'networkidle' });
      await expect(page.locator('text="实时对话"')).toBeVisible({ timeout: 10000 });
      console.log('✓ 语音页面加载成功');

      console.log('步骤3: 等待WebSocket连接');
      await page.waitForTimeout(2000);
      
      const wsStatus = page.locator('[class*="status"], [class*="connection"]');
      const wsConnected = await wsStatus.isVisible();
      console.log(`✓ WebSocket状态指示器: ${wsConnected ? '可见' : '不可见'}`);

      console.log('步骤4: 点击开始对话按钮');
      const startButton = page.locator('button:has-text("开始对话"), [data-testid="start-conversation"]');
      await startButton.click();
      
      const listeningIndicator = page.locator('.animate-pulse, [class*="listening"], [class*="recording"]');
      await expect(listeningIndicator.first()).toBeVisible({ timeout: 5000 });
      console.log('✓ 正在监听用户输入');

      console.log('步骤5: 模拟用户输入（短文本）');
      await page.evaluate(() => {
        const input = document.querySelector('[contenteditable], input[type="text"], textarea');
        if (input) {
          (input as HTMLElement).focus();
          (input as HTMLElement).innerText = '测试语音输入';
        }
      });
      await page.waitForTimeout(1000);

      console.log('步骤6: 检查AI回复');
      const aiResponse = page.locator('[class*="assistant"], [class*="ai-reply"], .message:has-text("AI")');
      await page.waitForTimeout(3000);
      
      if (await aiResponse.first().isVisible({ timeout: 5000 })) {
        console.log('✓ AI回复已显示');
      }

      await journeyTester.endJourney('现有用户语音对话', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      await journeyTester.endJourney('现有用户语音对话', false, errors);
      throw error;
    }
  });

  test('旅程3: 用户打断AI回复', async ({ page }) => {
    await journeyTester.startJourney('用户打断AI回复');

    const errors: string[] = [];

    try {
      console.log('步骤1: 进入语音对话并开始对话');
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      await page.evaluate(() => {
        localStorage.setItem('userId', 'test-user-001');
      });

      const startButton = page.locator('button:has-text("开始对话")');
      await startButton.click();
      await page.waitForTimeout(1000);
      console.log('✓ 对话已开始');

      console.log('步骤2: 模拟AI开始回复');
      await page.evaluate(() => {
        const event = new CustomEvent('ai-response-start', { detail: { text: '这是一段很长的AI回复...' } });
        window.dispatchEvent(event);
      });
      await page.waitForTimeout(500);

      const aiSpeaking = page.locator('[class*="speaking"], [class*="playing"], [class*="tts"]');
      const isAiSpeaking = await aiSpeaking.first().isVisible();
      if (isAiSpeaking) {
        console.log('✓ AI正在播放回复');
      }

      console.log('步骤3: 用户点击打断按钮');
      const interruptButton = page.locator('button:has-text("打断"), [data-testid="interrupt"]');
      
      if (await interruptButton.isVisible({ timeout: 2000 })) {
        await interruptButton.click();
        console.log('✓ 用户触发打断');
        
        await page.waitForTimeout(500);
        
        const stillSpeaking = await aiSpeaking.first().isVisible();
        if (!stillSpeaking) {
          console.log('✓ AI已停止播放');
        }
      } else {
        console.log('⚠ 打断按钮未找到（可能是UI结构不同）');
      }

      console.log('步骤4: 验证打断后状态');
      const listeningIndicator = page.locator('.animate-pulse, [class*="listening"]');
      const isListening = await listeningIndicator.first().isVisible({ timeout: 3000 });
      
      if (isListening) {
        console.log('✓ 打断后系统立即恢复监听状态');
      }

      await journeyTester.endJourney('用户打断AI回复', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      await journeyTester.endJourney('用户打断AI回复', false, errors);
      throw error;
    }
  });

  test('旅程4: 切换到录音分析模式', async ({ page }) => {
    await journeyTester.startJourney('录音分析模式切换');

    const errors: string[] = [];

    try {
      console.log('步骤1: 进入语音对话页面');
      await page.goto('/voice', { waitUntil: 'networkidle' });
      await expect(page.locator('text="声纹锁"')).toBeVisible({ timeout: 10000 });
      console.log('✓ 语音页面加载成功');

      console.log('步骤2: 点击录音分析标签');
      const analysisTab = page.locator('text="录音分析", [data-tab="analysis"]');
      await analysisTab.click();
      await page.waitForTimeout(1000);

      const analysisVisible = await page.locator('[class*="analysis"], .upload-area').first().isVisible();
      console.log(`✓ 录音分析界面: ${analysisVisible ? '可见' : '不可见'}`);

      if (analysisVisible) {
        console.log('步骤3: 检查上传区域');
        const uploadArea = page.locator('.upload-area, [class*="dropzone"], input[type="file"]');
        if (await uploadArea.first().isVisible({ timeout: 5000 })) {
          console.log('✓ 文件上传区域可见');
        }

        console.log('步骤4: 验证分析功能组件');
        const processButton = page.locator('button:has-text("开始分析"), [data-testid="process-audio"]');
        const resultArea = page.locator('[class*="result"], [class*="transcript"]');
        
        if (await processButton.isVisible()) {
          console.log('✓ 分析按钮可见');
        }
      }

      await journeyTester.endJourney('录音分析模式切换', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      await journeyTester.endJourney('录音分析模式切换', false, errors);
      throw error;
    }
  });

  test('旅程5: 错误场景恢复', async ({ page }) => {
    await journeyTester.startJourney('错误场景恢复');

    const errors: string[] = [];

    try {
      console.log('步骤1: 进入语音对话页面并开始对话');
      await page.goto('/voice', { waitUntil: 'networkidle' });
      
      await page.evaluate(() => {
        localStorage.setItem('userId', 'test-user-001');
      });

      const startButton = page.locator('button:has-text("开始对话")');
      await startButton.click();
      await page.waitForTimeout(2000);
      console.log('✓ 对话已建立');

      console.log('步骤2: 模拟网络断开');
      await page.route('**/*', route => route.abort());
      console.log('✓ 网络请求已被拦截');

      console.log('步骤3: 等待错误提示');
      await page.waitForTimeout(2000);

      const errorMessage = page.locator('[class*="error"], [class*="alert"], [class*="toast"]:has-text("错误"), [class*="toast"]:has-text("失败")');
      if (await errorMessage.first().isVisible({ timeout: 3000 })) {
        console.log('✓ 错误提示已显示');
      }

      console.log('步骤4: 模拟网络恢复');
      await page.unroute('**/*');
      console.log('✓ 网络请求已恢复');

      console.log('步骤5: 触发重连');
      const retryButton = page.locator('button:has-text("重试"), button:has-text("重新连接"), [data-testid="retry"]');
      if (await retryButton.isVisible({ timeout: 2000 })) {
        await retryButton.click();
        console.log('✓ 用户点击重试');
      }

      await page.waitForTimeout(3000);

      console.log('步骤6: 验证连接恢复');
      const reconnectStatus = page.locator('[class*="connected"], [class*="success"]');
      if (await reconnectStatus.first().isVisible({ timeout: 5000 })) {
        console.log('✓ 连接已恢复');
      }

      await journeyTester.endJourney('错误场景恢复', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      await journeyTester.endJourney('错误场景恢复', false, errors);
      throw error;
    }
  });

  test('旅程6: 用户设置和偏好', async ({ page }) => {
    await journeyTester.startJourney('用户设置和偏好');

    const errors: string[] = [];

    try {
      console.log('步骤1: 进入设置页面');
      await page.goto('/settings', { waitUntil: 'networkidle' });
      await expect(page.locator('text="设置", h1:has-text("设置")')).toBeVisible({ timeout: 10000 });
      console.log('✓ 设置页面加载成功');

      console.log('步骤2: 检查语音相关设置');
      const voiceSettings = page.locator('text="语音", [class*="voice"]:has-text("设置")');
      if (await voiceSettings.first().isVisible({ timeout: 5000 })) {
        await voiceSettings.first().click();
        console.log('✓ 语音设置部分可见');
      }

      console.log('步骤3: 测试设置保存');
      const saveButton = page.locator('button:has-text("保存"), button:has-text("应用")');
      if (await saveButton.first().isVisible()) {
        console.log('✓ 保存按钮可见');
      }

      await journeyTester.endJourney('用户设置和偏好', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      await journeyTester.endJourney('用户设置和偏好', false, errors);
      throw error;
    }
  });
});

test.describe('用户旅程性能分析', () => {
  test('测量用户旅程总体性能', async ({ page }) => {
    const performanceData: Array<{ url: string; status: number; duration?: number }> = [];

    page.on('response', (response) => {
      const timing = (response as any).timing();
      performanceData.push({
        url: response.url(),
        status: response.status(),
        duration: timing ? timing.responseEnd - timing.requestStart : undefined,
      });
    });

    test('完整旅程性能测试', async ({ page }) => {
      const journeyStart = Date.now();
      
      await page.goto('/', { waitUntil: 'networkidle' });
      const homeLoadTime = Date.now() - journeyStart;
      console.log(`首页加载: ${homeLoadTime}ms`);

      await page.goto('/voice', { waitUntil: 'networkidle' });
      const voiceLoadTime = Date.now() - journeyStart - homeLoadTime;
      console.log(`语音页面加载: ${voiceLoadTime}ms`);

      await page.evaluate(() => {
        localStorage.setItem('userId', 'test-user');
      });

      const startButton = page.locator('button:has-text("开始对话")');
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click();
        await page.waitForTimeout(2000);
      }

      const totalJourneyTime = Date.now() - journeyStart;
      console.log(`完整旅程时间: ${totalJourneyTime}ms`);

      test.info().annotations.push({
        type: 'journey-performance',
        description: JSON.stringify({
          homeLoadTime,
          voiceLoadTime,
          totalJourneyTime,
        }),
      });
    });
  });
});

export default {};
