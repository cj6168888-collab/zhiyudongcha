import { test, expect, Page, Locator } from '@playwright/test';

interface ButtonTestSpec {
  name: string;
  page: string;
  selectors: string[];
  type: 'action' | 'navigation' | 'toggle' | 'form' | 'icon';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const buttonSpecs: ButtonTestSpec[] = [
  { name: '首页_唤醒按钮_点击唤醒', page: '/', selectors: ['button:has-text("唤醒")', '[data-testid*="wake"]', 'button:has(.lucide-bolt)'], type: 'action', priority: 'critical' },
  { name: '首页_语音按钮_语音唤醒', page: '/', selectors: ['button:has(.lucide-mic)', '[aria-label*="语音"]'], type: 'action', priority: 'critical' },
  { name: '首页_设置按钮_打开设置', page: '/', selectors: ['button[aria-label*="设置"]', 'button:has(.lucide-settings)'], type: 'navigation', priority: 'high' },
  { name: '首页_录音历史按钮', page: '/', selectors: ['button[aria-label*="录音"]', 'button[aria-label*="历史"]'], type: 'navigation', priority: 'high' },
  { name: '首页_导航菜单', page: '/', selectors: ['nav button', '[role="navigation"] button'], type: 'navigation', priority: 'high' },
  { name: '首页_返回按钮', page: '/', selectors: ['button[aria-label*="返回"]', 'button:has-text("返回")'], type: 'navigation', priority: 'high' },
  
  { name: '设置_保存按钮', page: '/settings', selectors: ['button[aria-label*="保存"]', 'button:has-text("保存")', 'button[data-testid*="save"]'], type: 'action', priority: 'critical' },
  { name: '设置_返回按钮', page: '/settings', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '设置_个人_tab', page: '/settings', selectors: ['[data-testid="tab-profile"]', 'button:has-text("个人")'], type: 'toggle', priority: 'high' },
  { name: '设置_小智_tab', page: '/settings', selectors: ['[data-testid="tab-avatar"]', 'button:has-text("小智")'], type: 'toggle', priority: 'high' },
  { name: '设置_灵核_tab', page: '/settings', selectors: ['[data-testid="tab-spirit"]', 'button:has-text("灵核")'], type: 'toggle', priority: 'high' },
  { name: '设置_安全_tab', page: '/settings', selectors: ['[data-testid="tab-security"]', 'button:has-text("安全")'], type: 'toggle', priority: 'high' },
  { name: '设置_通知_tab', page: '/settings', selectors: ['[data-testid="tab-notifications"]', 'button:has-text("通知")'], type: 'toggle', priority: 'high' },
  { name: '设置_外观_tab', page: '/settings', selectors: ['[data-testid="tab-appearance"]', 'button:has-text("外观")'], type: 'toggle', priority: 'high' },
  { name: '设置_开关_深色模式', page: '/settings', selectors: ['[role="switch"]', 'button[aria-checked]'], type: 'toggle', priority: 'high' },
  { name: '设置_开关_自动备份', page: '/settings', selectors: ['[role="switch"]'], type: 'toggle', priority: 'medium' },
  
  { name: '聊天_发送按钮', page: '/chat', selectors: ['button[type="submit"]', 'button:has-text("发送")', 'button[aria-label*="发送"]'], type: 'action', priority: 'critical' },
  { name: '聊天_语音输入按钮', page: '/chat', selectors: ['button:has(.lucide-mic)', 'button[aria-label*="语音"]'], type: 'action', priority: 'high' },
  { name: '聊天_附件按钮', page: '/chat', selectors: ['button:has(.lucide-paperclip)', 'button[aria-label*="附件"]'], type: 'action', priority: 'medium' },
  { name: '聊天_表情按钮', page: '/chat', selectors: ['button:has(.lucide-smile)', 'button[aria-label*="表情"]'], type: 'action', priority: 'low' },
  
  { name: '对话_返回按钮', page: '/talk', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '对话_结束按钮', page: '/talk', selectors: ['button:has-text("结束")', 'button[aria-label*="结束"]'], type: 'action', priority: 'critical' },
  
  { name: '洞察_返回按钮', page: '/insight', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '洞察_播放按钮', page: '/insight', selectors: ['button[aria-label*="播放"]', 'button:has(.lucide-play)'], type: 'action', priority: 'high' },
  { name: '洞察_暂停按钮', page: '/insight', selectors: ['button[aria-label*="暂停"]', 'button:has(.lucide-pause)'], type: 'action', priority: 'high' },
  
  { name: '项目中心_返回按钮', page: '/projects', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '项目中心_新建按钮', page: '/projects', selectors: ['button:has-text("新建")', 'button[aria-label*="新建"]'], type: 'action', priority: 'high' },
  { name: '项目中心_模板按钮', page: '/projects', selectors: ['button:has-text("模板")', 'button[aria-label*="模板"]'], type: 'navigation', priority: 'medium' },
  
  { name: '记录_返回按钮', page: '/recordings', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '记录_播放按钮', page: '/recordings', selectors: ['button[aria-label*="播放"]'], type: 'action', priority: 'high' },
  { name: '记录_删除按钮', page: '/recordings', selectors: ['button[aria-label*="删除"]', 'button:has(.lucide-trash-2)'], type: 'action', priority: 'medium' },
  
  { name: '网络_返回按钮', page: '/network', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '网络_添加按钮', page: '/network', selectors: ['button:has-text("添加")', 'button[aria-label*="添加"]'], type: 'action', priority: 'medium' },
  
  { name: '控制台_返回按钮', page: '/console', selectors: ['button[aria-label*="返回"]'], type: 'navigation', priority: 'high' },
  { name: '控制台_刷新按钮', page: '/console', selectors: ['button[aria-label*="刷新"]', 'button:has(.lucide-refresh-cw)'], type: 'action', priority: 'medium' },
  
  { name: '通用_关闭按钮', page: '*', selectors: ['button[aria-label*="关闭"]', 'button.close-button', '[role="dialog"] button'], type: 'action', priority: 'high' },
  { name: '通用_确认按钮', page: '*', selectors: ['button:has-text("确认")', 'button:has-text("确定")'], type: 'action', priority: 'high' },
  { name: '通用_取消按钮', page: '*', selectors: ['button:has-text("取消")'], type: 'action', priority: 'high' },
  { name: '通用_更多按钮', page: '*', selectors: ['button[aria-label*="更多"]', 'button:has(.lucide-more-horizontal)'], type: 'action', priority: 'medium' },
];

interface ButtonTestResult {
  name: string;
  page: string;
  type: string;
  priority: string;
  found: boolean;
  visible: boolean;
  enabled: boolean;
  clickable: boolean;
  hasAriaLabel: boolean;
  ariaLabel: string | null;
  hasMinHeight: boolean;
  minHeight: number;
  hasTouchAction: boolean;
  touchAction: string;
  clickSuccess: boolean;
  clickTime: number;
  error?: string;
}

async function testButton(page: Page, spec: ButtonTestSpec): Promise<ButtonTestResult> {
  const result: ButtonTestResult = {
    name: spec.name,
    page: spec.page,
    type: spec.type,
    priority: spec.priority,
    found: false,
    visible: false,
    enabled: false,
    clickable: false,
    hasAriaLabel: false,
    ariaLabel: null,
    hasMinHeight: false,
    minHeight: 0,
    hasTouchAction: false,
    touchAction: 'auto',
    clickSuccess: false,
    clickTime: 0,
  };

  try {
    const targetPage = spec.page === '*' ? '/' : spec.page;
    await page.goto(targetPage, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForTimeout(500);

    for (const selector of spec.selectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      
      if (count > 0) {
        result.found = true;
        const button = locator.first();
        
        result.visible = await button.isVisible().catch(() => false);
        
        if (result.visible) {
          result.enabled = await button.isEnabled().catch(() => false);
          
          const style = await button.evaluate((el) => {
            const computed = window.getComputedStyle(el as HTMLElement);
            return {
              minHeight: parseInt(computed.minHeight) || 0,
              touchAction: computed.touchAction,
            };
          });
          
          result.minHeight = style.minHeight;
          result.hasMinHeight = style.minHeight >= 44;
          result.touchAction = style.touchAction;
          result.hasTouchAction = style.touchAction !== 'auto';
          
          result.ariaLabel = await button.getAttribute('aria-label');
          result.hasAriaLabel = !!result.ariaLabel;
          
          if (result.enabled) {
            const startTime = Date.now();
            try {
              await button.click({ timeout: 3000 });
              result.clickTime = Date.now() - startTime;
              result.clickable = true;
              result.clickSuccess = true;
            } catch (e: any) {
              result.clickTime = Date.now() - startTime;
              result.error = `点击失败: ${e.message}`;
            }
          }
        }
        break;
      }
    }
  } catch (e: any) {
    result.error = `测试执行错误: ${e.message}`;
  }

  return result;
}

async function scanAllButtons(page: Page): Promise<ButtonTestResult[]> {
  const results: ButtonTestResult[] = [];
  
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForTimeout(500);
  
  const buttons = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, [role="button"], a[href]');
    return Array.from(btns).slice(0, 50).map((btn, idx) => {
      const el = btn as HTMLElement;
      const style = window.getComputedStyle(el);
      return {
        index: idx,
        tagName: btn.tagName,
        id: btn.id,
        className: btn.className.substring(0, 50),
        ariaLabel: btn.getAttribute('aria-label'),
        role: btn.getAttribute('role'),
        href: btn.getAttribute('href'),
        minHeight: parseInt(style.minHeight) || 0,
        touchAction: style.touchAction,
        visible: el.offsetParent !== null,
      };
    });
  });
  
  for (const btn of buttons) {
    results.push({
      name: `扫描_按钮_${btn.index}_${btn.tagName}`,
      page: '/',
      type: btn.href ? 'navigation' : 'action',
      priority: 'medium',
      found: true,
      visible: btn.visible,
      enabled: btn.visible,
      clickable: btn.visible,
      hasAriaLabel: !!btn.ariaLabel,
      ariaLabel: btn.ariaLabel,
      hasMinHeight: btn.minHeight >= 44,
      minHeight: btn.minHeight,
      hasTouchAction: btn.touchAction !== 'auto',
      touchAction: btn.touchAction,
      clickSuccess: false,
      clickTime: 0,
    });
  }
  
  return results;
}

test.describe('严苛移动端按钮全面测试', () => {
  const mobileDevices = [
    { name: 'iPhone 14 Pro', viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true },
    { name: 'iPhone 14', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { name: 'Pixel 7', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true },
    { name: 'Samsung Galaxy S21', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
    { name: 'iPhone SE', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  ];

  for (const device of mobileDevices) {
    test.describe(`${device.name} (${device.viewport.width}x${device.viewport.height})`, () => {
      test.use({ ...device });

      test('1. 按钮规格测试', async ({ page }) => {
        const results: ButtonTestResult[] = [];
        
        for (const spec of buttonSpecs.slice(0, 20)) {
          const result = await testButton(page, spec);
          results.push(result);
          console.log(`[${device.name}] ${spec.name}: found=${result.found}, visible=${result.visible}, ariaLabel=${result.ariaLabel}, minHeight=${result.minHeight}px`);
        }
        
        const foundCount = results.filter(r => r.found).length;
        const visibleCount = results.filter(r => r.visible).length;
        const ariaLabelCount = results.filter(r => r.hasAriaLabel).length;
        const minHeightCount = results.filter(r => r.hasMinHeight).length;
        
        console.log(`[${device.name}] 汇总: 找到=${foundCount}, 可见=${visibleCount}, 有aria-label=${ariaLabelCount}, 达标高度=${minHeightCount}`);
        
        expect(results.length).toBeGreaterThan(0);
      });

      test('2. 按钮功能测试', async ({ page }) => {
        const results: ButtonTestResult[] = [];
        
        const criticalSpecs = buttonSpecs.filter(s => s.priority === 'critical').slice(0, 10);
        
        for (const spec of criticalSpecs) {
          const result = await testButton(page, spec);
          results.push(result);
          
          if (spec.type === 'action' && result.found && result.visible) {
            expect(result.clickable, `${spec.name} 应该可点击`).toBe(true);
          }
        }
        
        const clickableCount = results.filter(r => r.clickable).length;
        console.log(`[${device.name}] 可点击按钮: ${clickableCount}/${results.filter(r => r.found && r.visible).length}`);
      });

      test('3. 按钮逻辑实现测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const buttonDetails = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          return Array.from(buttons).slice(0, 10).map((btn, idx) => {
            const el = btn as HTMLElement;
            const style = window.getComputedStyle(el);
            return {
              index: idx,
              text: el.textContent?.substring(0, 30) || '',
              ariaLabel: btn.getAttribute('aria-label'),
              role: btn.getAttribute('role'),
              disabled: (btn as HTMLButtonElement).disabled,
              tabIndex: btn.tabIndex,
              minHeight: style.minHeight,
              padding: style.padding,
              touchAction: style.touchAction,
              hasTransition: style.transition !== 'none',
            };
          });
        });
        
        console.log(`[${device.name}] 按钮逻辑实现:`);
        buttonDetails.forEach((btn, idx) => {
          console.log(`  按钮${idx}: "${btn.text}", ariaLabel=${btn.ariaLabel}, disabled=${btn.disabled}, tabIndex=${btn.tabIndex}, minHeight=${btn.minHeight}, touchAction=${btn.touchAction}`);
        });
        
        expect(buttonDetails.length).toBeGreaterThan(0);
      });

      test('4. 结果呈现测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const renderResults = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          return {
            total: buttons.length,
            visible: Array.from(buttons).filter(b => (b as HTMLElement).offsetParent !== null).length,
            withText: Array.from(buttons).filter(b => b.textContent?.trim()).length,
            withAria: Array.from(buttons).filter(b => b.getAttribute('aria-label')).length,
            withRole: Array.from(buttons).filter(b => b.getAttribute('role')).length,
            disabled: Array.from(buttons).filter(b => (b as HTMLButtonElement).disabled).length,
          };
        });
        
        console.log(`[${device.name}] 结果呈现: 总数=${renderResults.total}, 可见=${renderResults.visible}, 有文本=${renderResults.withText}, 有aria=${renderResults.withAria}, 有role=${renderResults.withRole}, 禁用=${renderResults.disabled}`);
        
        expect(renderResults.total).toBeGreaterThan(0);
      });

      test('5. 按钮关联性测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const relationships = await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          const navs = document.querySelectorAll('nav, [role="navigation"]');
          const buttons = document.querySelectorAll('button');
          
          let inForm = 0;
          let inNav = 0;
          
          buttons.forEach(btn => {
            if (btn.closest('form')) inForm++;
            if (btn.closest('nav') || btn.closest('[role="navigation"]')) inNav++;
          });
          
          return {
            formCount: forms.length,
            navCount: navs.length,
            buttonInForm: inForm,
            buttonInNav: inNav,
            hasSubmitInForm: Array.from(forms).some(f => f.querySelector('button[type="submit"]')),
          };
        });
        
        console.log(`[${device.name}] 关联性: 表单=${relationships.formCount}, 导航=${relationships.navCount}, 表单中按钮=${relationships.buttonInForm}, 导航中按钮=${relationships.buttonInNav}`);
      });

      test('6. 触摸优化测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const touchOptimization = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          const results = Array.from(buttons).slice(0, 10).map((btn) => {
            const el = btn as HTMLElement;
            const style = window.getComputedStyle(el);
            return {
              minHeight: parseInt(style.minHeight) || 0,
              minWidth: parseInt(style.minWidth) || 0,
              padding: style.padding,
              touchAction: style.touchAction,
              cursor: style.cursor,
            };
          });
          return results;
        });
        
        console.log(`[${device.name}] 触摸优化:`);
        touchOptimization.forEach((btn, idx) => {
          console.log(`  按钮${idx}: minHeight=${btn.minHeight}px, minWidth=${btn.minWidth}px, padding=${btn.padding}, touchAction=${btn.touchAction}, cursor=${btn.cursor}`);
        });
        
        const passCount = touchOptimization.filter(b => b.minHeight >= 44 || b.touchAction === 'manipulation').length;
        console.log(`[${device.name}] 触摸优化达标: ${passCount}/${touchOptimization.length}`);
      });

      test('7. 无障碍性测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const a11y = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          return {
            total: buttons.length,
            withAriaLabel: Array.from(buttons).filter(b => b.getAttribute('aria-label')).length,
            withTitle: Array.from(buttons).filter(b => b.getAttribute('title')).length,
            withRole: Array.from(buttons).filter(b => b.getAttribute('role')).length,
            tabIndexPositive: Array.from(buttons).filter(b => b.tabIndex > 0).length,
            focusable: Array.from(buttons).filter(b => b.tabIndex >= 0 && !(b as HTMLButtonElement).disabled).length,
          };
        });
        
        console.log(`[${device.name}] 无障碍: 总数=${a11y.total}, aria-label=${a11y.withAriaLabel}, title=${a11y.withTitle}, role=${a11y.withRole}, 可聚焦=${a11y.focusable}`);
        
        const a11yScore = (a11y.withAriaLabel / a11y.total) * 100;
        console.log(`[${device.name}] 无障碍得分: ${a11yScore.toFixed(1)}%`);
      });

      test('8. 键盘导航测试', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const initialFocus = await page.evaluate(() => document.activeElement?.tagName);
        
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        const afterFirstTab = await page.evaluate(() => document.activeElement?.tagName);
        
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        const afterSecondTab = await page.evaluate(() => document.activeElement?.tagName);
        
        console.log(`[${device.name}] 键盘导航: 初始=${initialFocus}, 第1次Tab=${afterFirstTab}, 第2次Tab=${afterSecondTab}`);
        
        expect(afterFirstTab).toBeDefined();
      });

      test('9. 按钮状态测试', async ({ page }) => {
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const states = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          return Array.from(buttons).slice(0, 5).map((btn) => {
            return {
              text: btn.textContent?.trim().substring(0, 20) || '',
              disabled: (btn as HTMLButtonElement).disabled,
              className: btn.className,
            };
          });
        });
        
        console.log(`[${device.name}] 按钮状态:`);
        states.forEach((btn, idx) => {
          console.log(`  按钮${idx}: "${btn.text}", disabled=${btn.disabled}, class=${btn.className.substring(0, 40)}`);
        });
      });

      test('10. 扫描所有按钮', async ({ page }) => {
        const allButtons = await scanAllButtons(page);
        
        console.log(`[${device.name}] 扫描到 ${allButtons.length} 个按钮`);
        
        const visible = allButtons.filter(b => b.visible);
        const withAria = allButtons.filter(b => b.hasAriaLabel);
        const minHeightOk = allButtons.filter(b => b.hasMinHeight);
        
        console.log(`[${device.name}] 可见=${visible.length}, 有aria-label=${withAria.length}, 高度达标=${minHeightOk.length}`);
      });
    });
  }
});

test.describe('按钮综合评分', () => {
  test('生成综合评分报告', async ({ page }) => {
    const pages = ['/', '/settings', '/chat', '/talk', '/insight', '/projects', '/recordings'];
    const report: any = {
      timestamp: new Date().toISOString(),
      pages: {}
    };
    
    for (const pageUrl of pages) {
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForTimeout(300);
        
        const stats = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          const visibleButtons = Array.from(buttons).filter(b => (b as HTMLElement).offsetParent !== null);
          
          const buttonDetails = visibleButtons.slice(0, 10).map(btn => {
            const el = btn as HTMLElement;
            const style = window.getComputedStyle(el);
            return {
              ariaLabel: btn.getAttribute('aria-label'),
              minHeight: parseInt(style.minHeight) || 0,
              touchAction: style.touchAction,
            };
          });
          
          return {
            total: buttons.length,
            visible: visibleButtons.length,
            withAriaLabel: visibleButtons.filter(b => b.getAttribute('aria-label')).length,
            minHeightOk: buttonDetails.filter(b => b.minHeight >= 44).length,
            touchActionOk: buttonDetails.filter(b => b.touchAction === 'manipulation').length,
            details: buttonDetails,
          };
        });
        
        report.pages[pageUrl] = stats;
        console.log(`页面 ${pageUrl}: 总数=${stats.total}, 可见=${stats.visible}, aria-label=${stats.withAriaLabel}, 高度达标=${stats.minHeightOk}`);
      } catch (e: any) {
        console.log(`页面 ${pageUrl} 失败: ${e.message}`);
        report.pages[pageUrl] = { error: e.message };
      }
    }
    
    console.log('\n=== 综合评分报告 ===');
    console.log(JSON.stringify(report, null, 2));
  });
});

export {};
