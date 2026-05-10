/**
 * 性能测试脚本
 * 使用 Playwright 的 Performance API 进行深度性能测量
 */

import { test, expect, type Page } from '@playwright/test';

interface PerformanceMetrics {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

class PerformanceCollector {
  private page: Page;
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async collectLCP(): Promise<number> {
    return await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            observer.disconnect();
            resolve(lastEntry.startTime);
          });
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          
          setTimeout(() => {
            observer.disconnect();
            resolve(0);
          }, 10000);
        } catch {
          resolve(0);
        }
      });
    });
  }

  async collectCLS(): Promise<number> {
    return await this.page.evaluate(() => {
      let clsValue = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        
        setTimeout(() => {
          observer.disconnect();
        }, 5000);
      } catch {
        // CLS 不可用
      }
      return clsValue;
    });
  }

  async collectFID(): Promise<number> {
    return await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const firstInput = entries[0] as any;
              observer.disconnect();
              resolve(firstInput.processingStart - firstInput.startTime);
            }
          });
          observer.observe({ entryTypes: ['first-input'] });
          
          setTimeout(() => {
            observer.disconnect();
            resolve(-1);
          }, 10000);
        } catch {
          resolve(-1);
        }
      });
    });
  }

  async collectFCP(): Promise<number> {
    return await this.page.evaluate(() => {
      const fcpEntries = performance.getEntriesByType('paint');
      const fcpEntry = fcpEntries.find((entry) => entry.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : 0;
    });
  }

  async collectTTFB(): Promise<number> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as any;
      return navigation ? navigation.responseStart - navigation.requestStart : 0;
    });
  }

  async collectCustomMetrics(metrics: { name: string; entryType: string }[]): Promise<Record<string, number>> {
    return await this.page.evaluate((metricDefs) => {
      const results: Record<string, number> = {};
      
      metricDefs.forEach((metric) => {
        const entries = performance.getEntriesByType(metric.entryType);
        if (entries.length > 0) {
          const lastEntry = entries[entries.length - 1] as any;
          results[metric.name] = lastEntry.startTime || lastEntry.duration || 0;
        }
      });
      
      return results;
    }, metrics);
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  async measurePageLoad(url: string): Promise<any> {
    const navigationStart = Date.now();
    
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    const domContentLoaded = Date.now() - navigationStart;
    
    await this.page.waitForLoadState('networkidle');
    const fullLoad = Date.now() - navigationStart;

    const lcp = await this.collectLCP();
    const fcp = await this.collectFCP();
    const cls = await this.collectCLS();
    const ttfb = await this.collectTTFB();

    return {
      url,
      navigationStart,
      domContentLoaded,
      fullLoad,
      lcp,
      fcp,
      cls,
      ttfb,
    };
  }

  async measureInteractionDelay(selector: string): Promise<number> {
    await this.page.waitForSelector(selector);
    
    const startTime = Date.now();
    await this.page.click(selector);
    const endTime = Date.now();
    
    return endTime - startTime;
  }

  async measureResourceTiming(): Promise<any[]> {
    return await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as any[];
      return resources.slice(0, 20).map(resource => ({
        name: resource.name,
        duration: resource.duration,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
        decodedBodySize: resource.decodedBodySize,
        initiatorType: resource.initiatorType,
      }));
    });
  }
}

test.describe('Core Web Vitals 测试', () => {
  test('LCP - 最大内容绘制', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const lcp = await collector.collectLCP();
    console.log(`LCP: ${lcp.toFixed(2)}ms`);
    
    expect(lcp).toBeLessThan(2500);
    
    test.info().annotations.push({
      type: 'web-vitals-lcp',
      description: JSON.stringify({ lcp, unit: 'ms' }),
    });
  });

  test('CLS - 累积布局偏移', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const cls = await collector.collectCLS();
    console.log(`CLS: ${cls.toFixed(4)}`);
    
    expect(cls).toBeLessThan(0.1);
    
    test.info().annotations.push({
      type: 'web-vitals-cls',
      description: JSON.stringify({ cls }),
    });
  });

  test('FID - 首次输入延迟', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    await page.waitForTimeout(1000);
    
    const fid = await collector.collectFID();
    console.log(`FID: ${fid}ms`);
    
    if (fid > 0) {
      expect(fid).toBeLessThan(100);
    }
    
    test.info().annotations.push({
      type: 'web-vitals-fid',
      description: JSON.stringify({ fid, unit: 'ms' }),
    });
  });

  test('FCP - 首次内容绘制', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    const fcp = await collector.collectFCP();
    console.log(`FCP: ${fcp.toFixed(2)}ms`);
    
    expect(fcp).toBeLessThan(2000);
    
    test.info().annotations.push({
      type: 'web-vitals-fcp',
      description: JSON.stringify({ fcp, unit: 'ms' }),
    });
  });

  test('TTFB - 首字节时间', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const ttfb = await collector.collectTTFB();
    console.log(`TTFB: ${ttfb.toFixed(2)}ms`);
    
    expect(ttfb).toBeLessThan(800);
    
    test.info().annotations.push({
      type: 'web-vitals-ttfb',
      description: JSON.stringify({ ttfb, unit: 'ms' }),
    });
  });
});

test.describe('页面加载性能测试', () => {
  test('首页完整加载性能', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    const metrics = await collector.measurePageLoad('/');
    
    console.log('=== 首页加载性能 ===');
    console.log(`DOMContentLoaded: ${metrics.domContentLoaded}ms`);
    console.log(`完全加载: ${metrics.fullLoad}ms`);
    console.log(`LCP: ${metrics.lcp.toFixed(2)}ms`);
    console.log(`FCP: ${metrics.fcp.toFixed(2)}ms`);
    console.log(`CLS: ${metrics.cls.toFixed(4)}`);
    console.log(`TTFB: ${metrics.ttfb.toFixed(2)}ms`);
    
    expect(metrics.domContentLoaded).toBeLessThan(1500);
    expect(metrics.fullLoad).toBeLessThan(3000);
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
    
    test.info().annotations.push({
      type: 'page-performance-home',
      description: JSON.stringify(metrics),
    });
  });

  test('语音页面加载性能', async ({ page }) => {
    const collector = new PerformanceCollector(page);
    
    const metrics = await collector.measurePageLoad('/voice');
    
    console.log('=== 语音页面加载性能 ===');
    console.log(`DOMContentLoaded: ${metrics.domContentLoaded}ms`);
    console.log(`完全加载: ${metrics.fullLoad}ms`);
    console.log(`LCP: ${metrics.lcp.toFixed(2)}ms`);
    console.log(`FCP: ${metrics.fcp.toFixed(2)}ms`);
    console.log(`CLS: ${metrics.cls.toFixed(4)}`);
    
    expect(metrics.domContentLoaded).toBeLessThan(1500);
    expect(metrics.fullLoad).toBeLessThan(3000);
    expect(metrics.lcp).toBeLessThan(2500);
    
    test.info().annotations.push({
      type: 'page-performance-voice',
      description: JSON.stringify(metrics),
    });
  });

  test('资源加载分析', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const collector = new PerformanceCollector(page);
    const resources = await collector.measureResourceTiming();
    
    console.log('=== 资源加载分析 ===');
    console.log(`资源数量: ${resources.length}`);
    
    const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const totalDuration = resources.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    console.log(`总传输大小: ${(totalSize / 1024).toFixed(2)}KB`);
    console.log(`总加载时间: ${totalDuration.toFixed(2)}ms`);
    
    const largeResources = resources.filter(r => (r.transferSize || 0) > 100000);
    console.log(`大资源数量 (>100KB): ${largeResources.length}`);
    
    test.info().annotations.push({
      type: 'resource-analysis',
      description: JSON.stringify({
        resourceCount: resources.length,
        totalSize,
        totalDuration,
        largeResourceCount: largeResources.length,
      }),
    });
  });
});

test.describe('交互性能测试', () => {
  test('首次交互延迟', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const collector = new PerformanceCollector(page);
    
    await page.waitForSelector('button, a, [role="button"]');
    
    const firstInteraction = Date.now();
    await page.click('button:first-child, a:first-child');
    const interactionDelay = Date.now() - firstInteraction;
    
    console.log(`首次交互延迟: ${interactionDelay}ms`);
    
    expect(interactionDelay).toBeLessThan(500);
    
    test.info().annotations.push({
      type: 'interaction-delay',
      description: JSON.stringify({ delay: interactionDelay, unit: 'ms' }),
    });
  });

  test('语音功能交互响应', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const collector = new PerformanceCollector(page);
    
    const startButton = page.locator('button:has-text("开始对话")');
    if (await startButton.isVisible({ timeout: 5000 })) {
      const startTime = Date.now();
      await startButton.click();
      const responseTime = Date.now() - startTime;
      
      console.log(`开始对话按钮响应: ${responseTime}ms`);
      
      expect(responseTime).toBeLessThan(500);
      
      const stopButton = page.locator('button:has-text("停止")');
      if (await stopButton.isVisible({ timeout: 3000 })) {
        console.log("语音对话功能正常");
      }
    }
    
    test.info().annotations.push({
      type: 'voice-interaction-performance',
      description: JSON.stringify({ responseTime: 'measured' }),
    });
  });

  test('页面切换性能', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const navigationStart = Date.now();
    await page.goto('/voice', { waitUntil: 'networkidle' });
    const navigationTime = Date.now() - navigationStart;
    
    console.log(`页面切换时间: ${navigationTime}ms`);
    
    expect(navigationTime).toBeLessThan(2000);
    
    test.info().annotations.push({
      type: 'navigation-performance',
      description: JSON.stringify({ navigationTime, unit: 'ms' }),
    });
  });
});

test.describe('WebSocket 性能测试', () => {
  test('WebSocket 连接时间', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const wsConnectionStart = Date.now();
    const consoleMessages: any[] = [];
    
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });
    
    const startButton = page.locator('button:has-text("开始对话")');
    if (await startButton.isVisible({ timeout: 5000 })) {
      await startButton.click();
      
      await page.waitForTimeout(3000);
      
      const connected = consoleMessages.some(
        msg => msg.text.includes('connected') || msg.text.includes('WebSocket')
      );
      
      const connectionTime = Date.now() - wsConnectionStart;
      console.log(`WebSocket连接尝试时间: ${connectionTime}ms`);
      console.log(`连接状态: ${connected ? '已建立' : '进行中'}`);
      
      expect(connectionTime).toBeLessThan(5000);
    }
    
    test.info().annotations.push({
      type: 'websocket-performance',
      description: JSON.stringify({ connectionTime: 'measured' }),
    });
  });
});

test.describe('内存和资源测试', () => {
  test('页面内存使用估算', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const memoryInfo = await page.evaluate(() => {
      const perf = performance as any;
      if (perf.memory) {
        return {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });
    
    if (memoryInfo) {
      console.log(`已使用堆内存: ${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`总堆内存: ${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`堆内存限制: ${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
      
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    } else {
      console.log('内存API不可用（仅Chrome支持）');
    }
    
    test.info().annotations.push({
      type: 'memory-usage',
      description: JSON.stringify(memoryInfo),
    });
  });

  test('长时间运行性能稳定性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const initialMetrics = await page.evaluate(() => {
      const perf = performance as any;
      return {
        memory: perf.memory?.usedJSHeapSize,
        timing: performance.timing.loadEventEnd - performance.timing.navigationStart,
      };
    });
    
    for (let i = 0; i < 5; i++) {
      await page.click('button:first-child').catch(() => {});
      await page.waitForTimeout(1000);
    }
    
    const finalMetrics = await page.evaluate(() => {
      const perf = performance as any;
      return {
        memory: perf.memory?.usedJSHeapSize,
      };
    });
    
    if (initialMetrics.memory && finalMetrics.memory) {
      const memoryGrowth = finalMetrics.memory - initialMetrics.memory;
      console.log(`内存增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
      
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);
    }
    
    test.info().annotations.push({
      type: 'performance-stability',
      description: JSON.stringify({ initialMetrics, finalMetrics }),
    });
  });
});

test.describe('渲染性能测试', () => {
  test('帧率稳定性', async ({ page }) => {
    const frameRates: number[] = [];
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const frameTimes = await page.evaluate(() => {
      const times: number[] = [];
      let lastTime = performance.now();
      
      function measureFrame() {
        const currentTime = performance.now();
        const delta = currentTime - lastTime;
        lastTime = currentTime;
        times.push(1000 / delta);
        
        if (times.length < 60) {
          requestAnimationFrame(measureFrame);
        }
      }
      
      requestAnimationFrame(measureFrame);
      
      return new Promise<number[]>((resolve) => {
        setTimeout(() => resolve(times), 2000);
      });
    });
    
    const avgFrameRate = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const minFrameRate = Math.min(...frameTimes);
    const maxFrameRate = Math.max(...frameTimes);
    
    console.log(`平均帧率: ${avgFrameRate.toFixed(2)}fps`);
    console.log(`最低帧率: ${minFrameRate.toFixed(2)}fps`);
    console.log(`最高帧率: ${maxFrameRate.toFixed(2)}fps`);
    
    expect(avgFrameRate).toBeGreaterThan(30);
    
    test.info().annotations.push({
      type: 'frame-rate',
      description: JSON.stringify({ avg: avgFrameRate, min: minFrameRate, max: maxFrameRate }),
    });
  });

  test('长任务检测', async ({ page }) => {
    const longTasks: any[] = [];
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const longTaskEntries = await page.evaluate(() => {
      return new Promise<any[]>((resolve) => {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const longTasks = entries.filter((entry: any) => entry.duration > 50);
            observer.disconnect();
            resolve(longTasks);
          });
          observer.observe({ entryTypes: ['longtask'] });
          
          setTimeout(() => {
            observer.disconnect();
            resolve([]);
          }, 5000);
        } catch {
          resolve([]);
        }
      });
    });
    
    console.log(`长任务数量 (>50ms): ${longTaskEntries.length}`);
    
    if (longTaskEntries.length > 0) {
      longTaskEntries.forEach((task, i) => {
        console.log(`任务${i + 1}: ${task.duration.toFixed(2)}ms`);
      });
    }
    
    expect(longTaskEntries.length).toBeLessThan(5);
    
    test.info().annotations.push({
      type: 'long-tasks',
      description: JSON.stringify({ count: longTaskEntries.length }),
    });
  });
});

export default {};
