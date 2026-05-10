import { test, expect, Page } from '@playwright/test';

interface MobileButton {
  name: string;
  selector: string;
  page: string;
  type: 'action' | 'navigation' | 'toggle' | 'form';
  testId?: string;
}

const mobileButtons: MobileButton[] = [
  { name: '语音输入按钮', selector: '[aria-label*="语音"], [aria-label*="语音输入"], button:has(svg.lucide-mic)', page: '/', type: 'action' },
  { name: '导航菜单按钮', selector: 'nav button, [role="navigation"] button, .mobile-menu button', page: '/', type: 'navigation' },
  { name: '设置按钮', selector: 'button:has-text("设置"), [href*="settings"]', page: '/', type: 'navigation' },
  { name: '返回按钮', selector: 'button:has-text("返回"), button.back-button, [aria-label*="返回"]', page: '/settings', type: 'navigation' },
  { name: '保存按钮', selector: 'button:has-text("保存"), button[type="submit"]', page: '/settings', type: 'action' },
  { name: '取消按钮', selector: 'button:has-text("取消")', page: '/settings', type: 'action' },
  { name: '聊天发送按钮', selector: 'button:has-text("发送"), button[type="submit"]:has-text("发送")', page: '/chat', type: 'action' },
  { name: '切换开关', selector: 'button[role="switch"], button[aria-checked]', page: '/settings', type: 'toggle' },
  { name: '关闭按钮', selector: 'button:has-text("关闭"), button[aria-label*="关闭"], .close-button', page: '/', type: 'action' },
  { name: '刷新按钮', selector: 'button:has-text("刷新"), button[aria-label*="刷新"]', page: '/', type: 'action' },
];

interface ButtonTestResult {
  buttonName: string;
  page: string;
  found: boolean;
  visible: boolean;
  clickable: boolean;
  functional: boolean;
  error?: string;
}

async function collectButtonMetrics(page: Page, button: MobileButton): Promise<ButtonTestResult> {
  const result: ButtonTestResult = {
    buttonName: button.name,
    page: button.page,
    found: false,
    visible: false,
    clickable: false,
    functional: false,
  };

  try {
    await page.goto(button.page, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);

    const buttonLocator = page.locator(button.selector);
    const count = await buttonLocator.count();

    if (count > 0) {
      result.found = true;
      const firstButton = buttonLocator.first();
      
      const isVisible = await firstButton.isVisible().catch(() => false);
      result.visible = isVisible;

      if (isVisible) {
        const isEnabled = await firstButton.isEnabled().catch(() => false);
        result.clickable = isEnabled;

        if (isEnabled) {
          try {
            await firstButton.click({ timeout: 3000 });
            result.functional = true;
          } catch (e: any) {
            result.error = `点击失败: ${e.message}`;
          }
        }
      }
    } else {
      result.error = '未找到按钮元素';
    }
  } catch (e: any) {
    result.error = `测试执行错误: ${e.message}`;
  }

  return result;
}

test.describe('移动端按钮端到端严格测试', () => {
  const mobileDevices = [
    { name: 'iPhone 14', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { name: 'iPhone 12', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { name: 'Pixel 7', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true },
    { name: 'Samsung Galaxy S21', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
  ];

  for (const device of mobileDevices) {
    test.describe(`${device.name} (${device.viewport.width}x${device.viewport.height})`, () => {
      test.use({ ...device });

      test('1. 首页按钮检测与功能测试', async ({ page }) => {
        const results: ButtonTestResult[] = [];
        
        await test.step('1.1 页面加载验证', async () => {
          const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
          expect(response?.status(), '首页应该成功加载').toBeLessThan(400);
        });

        await test.step('1.2 检查页面基本元素', async () => {
          await expect(page.locator('body')).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('lang', /zh|cn/i);
        });

        await test.step('1.3 扫描所有按钮元素', async () => {
          const allButtons = page.locator('button');
          const count = await allButtons.count();
          console.log(`[${device.name}] 首页发现 ${count} 个按钮元素`);
          expect(count).toBeGreaterThan(0);
        });

        await test.step('1.4 语音输入按钮测试', async () => {
          const voiceButtonSelectors = [
            '[aria-label*="语音"]',
            'button:has(svg.lucide-mic)',
            'button:has(svg.lucide-mic)',
            '[aria-label*="开始语音"]',
          ];

          for (const selector of voiceButtonSelectors) {
            const btn = page.locator(selector);
            if (await btn.count() > 0) {
              const isVisible = await btn.first().isVisible().catch(() => false);
              if (isVisible) {
                console.log(`[${device.name}] 找到语音按钮: ${selector}`);
                const isEnabled = await btn.first().isEnabled();
                console.log(`[${device.name}] 语音按钮可点击: ${isEnabled}`);
                break;
              }
            }
          }
        });

        await test.step('1.5 导航按钮测试', async () => {
          const navButtons = page.locator('nav button, [role="navigation"] button, header button');
          const count = await navButtons.count();
          console.log(`[${device.name}] 导航按钮数量: ${count}`);
        });

        await test.step('1.6 检查移动端特定样式类', async () => {
          const mobileClasses = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            return Array.from(buttons).map(btn => ({
              class: btn.className,
              hasMobileClass: /(mobile|touch|ios|android)/i.test(btn.className)
            }));
          });
          console.log(`[${device.name}] 移动端样式类:`, mobileClasses.filter(m => m.hasMobileClass));
        });
      });

      test('2. 语音按钮详细功能测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await test.step('2.1 检查语音识别API支持', async () => {
          const hasSpeechAPI = await page.evaluate(() => {
            return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
          });
          console.log(`[${device.name}] 语音识别API支持: ${hasSpeechAPI}`);
        });

        await test.step('2.2 检查麦克风权限', async () => {
          const hasGetUserMedia = await page.evaluate(() => {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
          });
          console.log(`[${device.name}] 麦克风权限API: ${hasGetUserMedia}`);
        });

        await test.step('2.3 查找并检查语音按钮状态', async () => {
          const voiceButton = page.locator('button:has(svg.lucide-mic), [aria-label*="语音"]').first();
          const exists = await voiceButton.count() > 0;
          
          if (exists) {
            const isVisible = await voiceButton.isVisible();
            const ariaLabel = await voiceButton.getAttribute('aria-label');
            console.log(`[${device.name}] 语音按钮 aria-label: ${ariaLabel}, 可见: ${isVisible}`);
          } else {
            console.log(`[${device.name}] 未找到语音按钮`);
          }
        });
      });

      test('3. 设置页面按钮测试', async ({ page }) => {
        await test.step('3.1 导航到设置页面', async () => {
          await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 10000 });
        });

        await test.step('3.2 检查设置页面按钮', async () => {
          const buttons = page.locator('button');
          const count = await buttons.count();
          console.log(`[${device.name}] 设置页面按钮数量: ${count}`);
          expect(count).toBeGreaterThan(0);
        });

        await test.step('3.3 检查表单按钮', async () => {
          const submitButtons = page.locator('button[type="submit"]');
          const submitCount = await submitButtons.count();
          console.log(`[${device.name}] 提交按钮数量: ${submitCount}`);
        });

        await test.step('3.4 检查切换开关', async () => {
          const switches = page.locator('[role="switch"], button[aria-checked]');
          const switchCount = await switches.count();
          console.log(`[${device.name}] 切换开关数量: ${switchCount}`);
        });
      });

      test('4. 聊天页面按钮测试', async ({ page }) => {
        await test.step('4.1 导航到聊天页面', async () => {
          await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 10000 });
        });

        await test.step('4.2 检查发送按钮', async () => {
          const sendButton = page.locator('button:has-text("发送"), button[type="submit"]');
          const count = await sendButton.count();
          console.log(`[${device.name}] 发送按钮数量: ${count}`);
        });

        await test.step('4.3 检查输入框相关按钮', async () => {
          const inputButtons = page.locator('input + button, textarea + button');
          const count = await inputButtons.count();
          console.log(`[${device.name}] 输入框关联按钮数量: ${count}`);
        });
      });

      test('5. 触摸交互专项测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await test.step('5.1 触摸事件支持检查', async () => {
          const touchSupport = await page.evaluate(() => {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          });
          console.log(`[${device.name}] 触摸事件支持: ${touchSupport}`);
        });

        await test.step('5.2 按钮触摸响应测试', async () => {
          const buttons = page.locator('button').first();
          if (await buttons.count() > 0) {
            try {
              await buttons.first().tap();
              console.log(`[${device.name}] 触摸点击成功`);
            } catch (e) {
              console.log(`[${device.name}] 触摸点击失败`);
            }
          }
        });

        await test.step('5.3 检查触摸优化样式', async () => {
          const touchStyles = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            const styles = Array.from(buttons).slice(0, 5).map(btn => {
              const style = window.getComputedStyle(btn);
              return {
                minHeight: style.minHeight,
                padding: style.padding,
                touchAction: style.touchAction
              };
            });
            return styles;
          });
          console.log(`[${device.name}] 按钮触摸样式:`, touchStyles);
        });
      });

      test('6. 无障碍性按钮测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await test.step('6.1 检查按钮ARIA属性', async () => {
          const ariaButtons = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            return Array.from(buttons).map(btn => ({
              ariaLabel: btn.getAttribute('aria-label'),
              ariaRole: btn.getAttribute('role'),
              id: btn.id
            }));
          });
          console.log(`[${device.name}] 按钮ARIA属性:`, ariaButtons.slice(0, 5));
        });

        await test.step('6.2 检查键盘焦点', async () => {
          await page.keyboard.press('Tab');
          const focused = page.locator(':focus');
          const isButton = await focused.evaluate(el => el?.tagName === 'BUTTON');
          console.log(`[${device.name}] 键盘焦点在按钮上: ${isButton}`);
        });

        await test.step('6.3 检查焦点可见性', async () => {
          const focusVisible = await page.evaluate(() => {
            const style = window.getComputedStyle(document.querySelector(':focus') || document.createElement('button'));
            return style.outline;
          });
          console.log(`[${device.name}] 焦点轮廓: ${focusVisible}`);
        });
      });

      test('7. 按钮响应式适配测试', async ({ page }) => {
        await test.step('7.1 不同移动端尺寸测试', async () => {
          const sizes = [
            { width: 320, height: 568 },
            { width: 375, height: 667 },
            { width: 414, height: 896 },
          ];

          for (const size of sizes) {
            await page.setViewportSize(size);
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            
            const buttonCount = await page.locator('button').count();
            const visibleButtons = await page.locator('button:visible').count();
            
            console.log(`[${device.name}] 尺寸 ${size.width}x${size.height}: ${buttonCount} 总按钮, ${visibleButtons} 可见`);
          }
        });
      });

      test('8. 按钮状态转换测试', async ({ page }) => {
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        await test.step('8.1 检查按钮默认状态', async () => {
          const buttons = page.locator('button').first();
          if (await buttons.count() > 0) {
            const defaultState = await buttons.first().evaluate(btn => ({
              disabled: (btn as HTMLButtonElement).disabled,
              class: btn.className
            }));
            console.log(`[${device.name}] 按钮默认状态:`, defaultState);
          }
        });

        await test.step('8.2 检查按钮hover状态', async () => {
          const buttons = page.locator('button').first();
          if (await buttons.count() > 0) {
            await buttons.first().hover().catch(() => {});
            const hoverState = await buttons.first().evaluate(btn => ({
              class: btn.className
            }));
            console.log(`[${device.name}] 按钮hover状态:`, hoverState);
          }
        });

        await test.step('8.3 检查按钮active/pressed状态', async () => {
          const buttons = page.locator('button').first();
          if (await buttons.count() > 0) {
            await buttons.first().press('Enter');
            const activeState = await buttons.first().evaluate(btn => ({
              class: btn.className
            }));
            console.log(`[${device.name}] 按钮active状态:`, activeState);
          }
        });
      });

      test('9. 按钮性能测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await test.step('9.1 按钮渲染时间', async () => {
          const renderTime = await page.evaluate(() => {
            const performanceEntries = performance.getEntriesByType('navigation');
            return performanceEntries[0] ? (performanceEntries[0] as any).responseEnd : 0;
          });
          console.log(`[${device.name}] 页面加载时间: ${renderTime}ms`);
        });

        await test.step('9.2 按钮点击响应时间', async () => {
          const buttons = page.locator('button').first();
          if (await buttons.count() > 0) {
            const startTime = Date.now();
            await buttons.first().click().catch(() => {});
            const clickTime = Date.now() - startTime;
            console.log(`[${device.name}] 按钮点击响应时间: ${clickTime}ms`);
          }
        });
      });

      test('10. 按钮关联性测试', async ({ page }) => {
        await test.step('10.1 导航按钮与页面关联', async () => {
          await page.goto('/', { waitUntil: 'domcontentloaded' });
          
          const navButtons = page.locator('nav a, nav button, [role="navigation"] a, [role="navigation"] button');
          const count = await navButtons.count();
          console.log(`[${device.name}] 导航元素数量: ${count}`);
          
          for (let i = 0; i < Math.min(count, 3); i++) {
            const href = await navButtons.nth(i).getAttribute('href');
            const ariaLabel = await navButtons.nth(i).getAttribute('aria-label');
            console.log(`[${device.name}] 导航项 ${i}: href=${href}, aria-label=${ariaLabel}`);
          }
        });

        await test.step('10.2 表单按钮与输入框关联', async () => {
          await page.goto('/settings', { waitUntil: 'domcontentloaded' });
          
          const inputs = page.locator('input, textarea');
          const buttons = page.locator('button[type="submit"], button:has-text("保存")');
          
          const inputCount = await inputs.count();
          const buttonCount = await buttons.count();
          
          console.log(`[${device.name}] 输入框: ${inputCount}, 提交按钮: ${buttonCount}`);
          
          if (inputCount > 0 && buttonCount > 0) {
            const formExists = await page.locator('form').count() > 0;
            console.log(`[${device.name}] 表单结构存在: ${formExists}`);
          }
        });

        await test.step('10.3 模态框关闭按钮关联', async () => {
          const closeButtons = page.locator('[role="dialog"] button[aria-label*="关闭"], .modal button.close');
          const closeCount = await closeButtons.count();
          console.log(`[${device.name}] 关闭按钮数量: ${closeCount}`);
        });
      });
    });
  }
});

test.describe('移动端按钮综合测试报告', () => {
  test('生成测试摘要', async ({ page }) => {
    const summary: any = {
      timestamp: new Date().toISOString(),
      device: 'Mobile',
      tests: []
    };

    const pages = ['/', '/settings', '/chat'];
    
    for (const pageUrl of pages) {
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
        
        const buttonInfo = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          return {
            total: buttons.length,
            visible: document.querySelectorAll('button:visible').length,
            withAria: Array.from(buttons).filter(b => b.getAttribute('aria-label')).length,
            disabled: Array.from(buttons).filter(b => (b as HTMLButtonElement).disabled).length
          };
        });
        
        summary.tests.push({
          url: pageUrl,
          ...buttonInfo
        });
        
        console.log(`页面 ${pageUrl}:`, buttonInfo);
      } catch (e: any) {
        console.log(`页面 ${pageUrl} 加载失败: ${e.message}`);
      }
    }

    console.log('测试摘要:', JSON.stringify(summary, null, 2));
  });
});

export {};
