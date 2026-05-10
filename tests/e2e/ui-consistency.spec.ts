/**
 * UI/UX 一致性测试脚本
 * 测试响应式设计、无障碍性、视觉一致性
 */

import { test, expect, type Page } from '@playwright/test';

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  device?: string;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: 'Mobile S', width: 320, height: 568 },
  { name: 'Mobile M', width: 375, height: 667 },
  { name: 'Mobile L', width: 425, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Laptop', width: 1280, height: 720 },
  { name: 'Laptop L', width: 1440, height: 900 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

class UIConsistencyTester {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async checkElementVisibility(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector).first();
      return await element.isVisible({ timeout: 2000 });
    } catch {
      return false;
    }
  }

  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  async getElementPosition(selector: string): Promise<{ x: number; y: number } | null> {
    try {
      const box = await this.page.locator(selector).first().boundingBox();
      return box ? { x: box.x, y: box.y } : null;
    } catch {
      return null;
    }
  }

  async checkA11yIssues(): Promise<{
    missingAlt: number;
    missingAria: number;
    missingLabels: number;
    duplicateIds: number;
  }> {
    const issues = {
      missingAlt: 0,
      missingAria: 0,
      missingLabels: 0,
      duplicateIds: 0,
    };

    issues.missingAlt = await this.page.locator('img:not([alt])').count();
    issues.missingAria = await this.page.locator('[aria-hidden="true"]:not(script):not(style)').count();
    issues.missingLabels = await this.page.locator('input:not([aria-label]):not([id])').count();
    
    const ids = await this.page.evaluate(() => {
      const allElements = document.querySelectorAll('[id]');
      const idCounts: Record<string, number> = {};
      allElements.forEach(el => {
        const id = el.getAttribute('id');
        if (id) {
          idCounts[id] = (idCounts[id] || 0) + 1;
        }
      });
      return Object.values(idCounts).filter(count => count > 1).length;
    });
    issues.duplicateIds = ids;

    return issues;
  }

  async checkColorContrast(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const issues: string[] = [];
      const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button');
      
      textElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        
        if (color === bgColor) {
          issues.push(`Contrast issue: ${el.tagName} has same foreground and background`);
        }
      });
      
      return issues;
    });
  }
}

test.describe('响应式设计测试', () => {
  let uiTester: UIConsistencyTester;

  test.beforeEach(async ({ page }) => {
    uiTester = new UIConsistencyTester(page);
  });

  test('首页响应式布局', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      test.step(`${viewport.name} (${viewport.width}x${viewport.height})`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/', { waitUntil: 'networkidle' });

        const mainContent = await uiTester.checkElementVisibility('main');
        expect(mainContent).toBe(true);

        const header = await uiTester.checkElementVisibility('header');
        const footer = await uiTester.checkElementVisibility('footer');
        
        console.log(`Header可见: ${header}, Footer可见: ${footer}`);
      });
    }
  });

  test('语音页面响应式布局', async ({ page }) => {
    for (const viewport of VIEWPORTS.slice(2)) {
      test.step(`${viewport.name} (${viewport.width}x${viewport.height})`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/voice', { waitUntil: 'networkidle' });

        const voiceInterface = await uiTester.checkElementVisibility('[class*="voice"], [class*="dialog"]');
        expect(voiceInterface).toBe(true);

        const buttons = await uiTester.getElementCount('button');
        console.log(`按钮数量: ${buttons}`);
        
        if (viewport.width >= 768) {
          const sidePanel = await uiTester.checkElementVisibility('[class*="sidebar"], [class*="panel"]');
          console.log(`侧边栏可见: ${sidePanel}`);
        }
      });
    }
  });

  test('导航菜单响应式行为', async ({ page }) => {
    for (const viewport of VIEWPORTS.slice(0, 4)) {
      test.step(`${viewport.name} - 导航行为`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/', { waitUntil: 'networkidle' });

        const hamburgerMenu = await uiTester.checkElementVisibility('[class*="hamburger"], [class*="menu-toggle"], .menu-btn');
        const navLinks = await uiTester.getElementCount('nav a, nav button');
        
        console.log(`${viewport.name}: 汉堡菜单=${hamburgerMenu}, 导航链接=${navLinks}`);
        
        if (hamburgerMenu) {
          await page.locator('[class*="hamburger"], [class*="menu-toggle"]').first().click();
          await page.waitForTimeout(500);
          
          const expandedMenu = await uiTester.checkElementVisibility('[class*="open"], [class*="expanded"]:visible');
          console.log(`展开菜单可见: ${expandedMenu}`);
        }
      });
    }
  });

  test('表单响应式布局', async ({ page }) => {
    for (const viewport of VIEWPORTS.slice(0, 3)) {
      test.step(`${viewport.name} - 表单布局`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/settings', { waitUntil: 'networkidle' });

        const formInputs = await uiTester.getElementCount('input, textarea, select');
        const labels = await uiTester.getElementCount('label, [class*="label"]');
        
        console.log(`${viewport.name}: 输入框=${formInputs}, 标签=${labels}`);
        
        if (viewport.width < 768) {
          const stackedLabels = await uiTester.getElementCount('label:has(+input)');
          console.log(`堆叠标签数量: ${stackedLabels}`);
        }
      });
    }
  });
});

test.describe('无障碍性测试', () => {
  let uiTester: UIConsistencyTester;

  test.beforeEach(async ({ page }) => {
    uiTester = new UIConsistencyTester(page);
  });

  test('图片无障碍属性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const issues = await uiTester.checkA11yIssues();
    
    console.log('=== 图片无障碍检查 ===');
    console.log(`缺少alt属性的图片: ${issues.missingAlt}`);
    
    expect(issues.missingAlt).toBe(0);
  });

  test('表单标签无障碍', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    
    const issues = await uiTester.checkA11yIssues();
    
    console.log('=== 表单无障碍检查 ===');
    console.log(`缺少标签的输入框: ${issues.missingLabels}`);
    
    expect(issues.missingLabels).toBe(0);
  });

  test('按钮和链接可访问性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const buttonsWithoutText = await page.locator('button:empty:not([aria-label])').count();
    const linksWithoutText = await page.locator('a:empty:not([aria-label])').count();
    
    console.log('=== 按钮链接无障碍检查 ===');
    console.log(`无文本按钮: ${buttonsWithoutText}`);
    console.log(`无文本链接: ${linksWithoutText}`);
    
    expect(buttonsWithoutText).toBe(0);
  });

  test('键盘导航支持', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    console.log(`第一个可聚焦元素: ${firstFocused}`);
    
    await page.keyboard.press('Tab');
    const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
    console.log(`第二个可聚焦元素: ${secondFocused}`);
    
    expect(firstFocused).toBeTruthy();
  });

  test('焦点指示器可见性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    await page.keyboard.press('Tab');
    const hasFocusOutline = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      const style = window.getComputedStyle(active);
      return style.outlineWidth !== '0px' && style.outline !== 'none';
    });
    
    console.log(`焦点指示器可见: ${hasFocusOutline}`);
    expect(hasFocusOutline).toBe(true);
  });

  test('ARIA 属性完整性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const buttonsWithAria = await page.locator('button[aria-label], button[aria-labelledby]').count();
    const totalButtons = await page.locator('button').count();
    
    console.log('=== ARIA 属性检查 ===');
    console.log(`有ARIA属性的按钮: ${buttonsWithAria}/${totalButtons}`);
    
    if (totalButtons > 0) {
      expect(buttonsWithAria).toBeGreaterThan(0);
    }
  });
});

test.describe('视觉一致性测试', () => {
  test('颜色方案一致性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const colors = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const colorSet = new Set<string>();
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.color) colorSet.add(style.color);
        if (style.backgroundColor) colorSet.add(style.backgroundColor);
      });
      
      return Array.from(colorSet);
    });
    
    console.log(`检测到不同的颜色值: ${colors.length}个`);
    
    const hexColors = colors.filter(c => c.startsWith('#'));
    console.log(`十六进制颜色数量: ${hexColors.length}`);
  });

  test('字体一致性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const fonts = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const fontSet = new Set<string>();
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.fontFamily) {
          fontSet.add(style.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
        }
      });
      
      return Array.from(fontSet);
    });
    
    console.log(`检测到的字体: ${fonts.join(', ')}`);
    expect(fonts.length).toBeLessThan(5);
  });

  test('间距一致性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const paddings = await page.evaluate(() => {
      const elements = document.querySelectorAll('.container, main, section, article');
      const paddingSet = new Set<string>();
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        paddingSet.add(`${style.paddingLeft}-${style.paddingRight}`);
      });
      
      return Array.from(paddingSet);
    });
    
    console.log(`检测到的内边距模式: ${paddings.length}种`);
  });

  test('组件尺寸一致性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const buttonSizes = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const sizeSet = new Set<string>();
      
      buttons.forEach(btn => {
        const style = window.getComputedStyle(btn);
        sizeSet.add(`${style.height}-${style.padding}`);
      });
      
      return Array.from(sizeSet);
    });
    
    console.log(`检测到的按钮尺寸: ${buttonSizes.length}种`);
    expect(buttonSizes.length).toBeLessThan(4);
  });
});

test.describe('布局稳定性测试', () => {
  let uiTester: UIConsistencyTester;

  test.beforeEach(async ({ page }) => {
    uiTester = new UIConsistencyTester(page);
  });

  test('CLS - 累积布局偏移', async ({ page }) => {
    const clsValues: number[] = [];
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const observer = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cls = 0;
        try {
          const obs = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                cls += entry.value;
              }
            });
          });
          obs.observe({ entryTypes: ['layout-shift'] });
          
          setTimeout(() => {
            obs.disconnect();
            resolve(cls);
          }, 5000);
        } catch {
          resolve(0);
        }
      });
    });
    
    console.log(`CLS值: ${observer.toFixed(4)}`);
    expect(observer).toBeLessThan(0.1);
  });

  test('图片加载布局稳定性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const positions = await uiTester.getElementPosition('img:first-child, [class*="hero"]');
    console.log(`初始元素位置: ${JSON.stringify(positions)}`);
    
    await page.waitForLoadState('networkidle');
    
    const newPositions = await uiTester.getElementPosition('img:first-child, [class*="hero"]');
    console.log(`加载后元素位置: ${JSON.stringify(newPositions)}`);
    
    if (positions && newPositions) {
      const shift = Math.abs(newPositions.y - positions.y);
      console.log(`垂直偏移: ${shift}px`);
      expect(shift).toBeLessThan(50);
    }
  });

  test('字体加载布局稳定性', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const textElement = page.locator('h1, .title').first();
    const initialHeight = await textElement.boundingBox();
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const finalHeight = await textElement.boundingBox();
    
    if (initialHeight && finalHeight) {
      const heightChange = Math.abs(finalHeight.height - initialHeight.height);
      console.log(`字体加载引起的高度变化: ${heightChange}px`);
      expect(heightChange).toBeLessThan(20);
    }
  });
});

test.describe('跨浏览器一致性测试', () => {
  let uiTester: UIConsistencyTester;

  test.beforeEach(async ({ page }) => {
    uiTester = new UIConsistencyTester(page);
  });

  test('元素渲染一致性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const mainElements = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? main.children.length : 0;
    });
    
    console.log(`主内容区域子元素数量: ${mainElements}`);
    expect(mainElements).toBeGreaterThan(0);
  });

  test('交互行为一致性', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const buttonCount = await uiTester.getElementCount('button');
    console.log(`页面按钮数量: ${buttonCount}`);
    
    const firstButton = page.locator('button').first();
    if (await firstButton.isVisible()) {
      const initialText = await firstButton.textContent();
      console.log(`第一个按钮文本: ${initialText}`);
      
      await firstButton.hover();
      await page.waitForTimeout(200);
      
      const afterHover = await firstButton.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          transform: style.transform,
        };
      });
      
      console.log(`悬停后样式: ${JSON.stringify(afterHover)}`);
    }
  });
});

test.describe('动画和过渡测试', () => {
  let uiTester: UIConsistencyTester;

  test.beforeEach(async ({ page }) => {
    uiTester = new UIConsistencyTester(page);
  });
  test('动画性能', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const animations = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let animatedCount = 0;
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.animationName !== 'none' || style.transition !== 'all 0s ease 0s') {
          animatedCount++;
        }
      });
      
      return animatedCount;
    });
    
    console.log(`有动画效果的元素: ${animations}个`);
  });

  test('过渡效果平滑度', async ({ page }) => {
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const hoverButton = page.locator('button:has-text("开始")').first();
    if (await hoverButton.isVisible()) {
      const initialTime = Date.now();
      await hoverButton.hover();
      const hoverTime = Date.now() - initialTime;
      
      console.log(`悬停响应时间: ${hoverTime}ms`);
      expect(hoverTime).toBeLessThan(100);
    }
  });

  test('禁用动画时的功能测试', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('reduce'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        }),
      });
      document.body.classList.add('reduced-motion');
    });
    
    await page.goto('/voice', { waitUntil: 'networkidle' });
    
    const mainVisible = await uiTester.checkElementVisibility('main');
    expect(mainVisible).toBe(true);
    
    const buttonVisible = await uiTester.checkElementVisibility('button');
    expect(buttonVisible).toBe(true);
  });
});

export default {};
