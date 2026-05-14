/**
 * 前端交互基线测试
 * 用于收集当前系统的性能、错误、用户体验数据
 */

import { test } from '@playwright/test';

test.describe('前端交互基线测试', () => {
  
  test('页面加载性能基线', async ({ page }) => {
    console.log('=== 页面加载性能基线 ===');
    
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    console.log(`总加载时间: ${loadTime}ms`);
    
    test.info().annotations.push({
      type: 'performance-baseline',
      description: JSON.stringify({ pageLoadTime: loadTime }),
    });
  });
  
  test('Core Web Vitals测量', async ({ page }) => {
    console.log('=== Core Web Vitals 基线 ===');
    
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const lastEntry = entries[entries.length - 1];
              observer.disconnect();
              resolve(lastEntry.startTime);
            }
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
    
    console.log(`LCP: ${lcp.toFixed(2)}ms`);
    
    const cls = await page.evaluate(() => {
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
    
    console.log(`CLS: ${cls.toFixed(4)}`);
    
    test.info().annotations.push({
      type: 'web-vitals-baseline',
      description: JSON.stringify({ LCP: lcp, CLS: cls }),
    });
  });
  
  test('语音交互模块测试', async ({ page }) => {
    console.log('=== 语音交互模块基线 ===');
    
    await page.goto('/dashboard/voice', { waitUntil: 'networkidle' });
    
    const voiceprintVisible = await page.locator('text="声纹锁"').isVisible();
    const realtimeVisible = await page.locator('text="实时对话"').isVisible();
    
    console.log(`声纹锁组件: ${voiceprintVisible ? '可见' : '不可见'}`);
    console.log(`实时对话组件: ${realtimeVisible ? '可见' : '不可见'}`);
    
    if (realtimeVisible) {
      await page.locator('text="实时对话"').click();
      await page.waitForTimeout(300);
      const connectVisible = await page.locator('text="连接语音服务"').isVisible();
      console.log(`连接按钮: ${connectVisible ? '可见' : '不可见'}`);
    }
    
    test.info().annotations.push({
      type: 'voice-baseline',
      description: JSON.stringify({ voiceprintVisible, realtimeVisible }),
    });
  });
  
  test('控制台错误基线', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('=== 控制台错误基线 ===');
    console.log(`错误数量: ${errors.length}`);
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
    
    test.info().annotations.push({
      type: 'errors-baseline',
      description: JSON.stringify(errors),
    });
  });
  
  test('响应式布局测试', async ({ page }) => {
    console.log('=== 响应式布局基线 ===');
    
    const viewports = [
      { name: 'Mobile', width: 375 },
      { name: 'Tablet', width: 768 },
      { name: 'Desktop', width: 1280 },
    ];
    
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: 667 });
      await page.goto('/', { waitUntil: 'networkidle' });
      
      const mainVisible = await page.locator('main').first().isVisible();
      console.log(`${vp.name} (${vp.width}px): 主内容 ${mainVisible ? '可见' : '不可见'}`);
    }
    
    test.info().annotations.push({
      type: 'responsive-baseline',
      description: 'Responsive layout tested',
    });
  });
});

export default {};
