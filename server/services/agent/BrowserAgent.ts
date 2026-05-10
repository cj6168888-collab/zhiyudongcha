/**
 * BrowserAgent - 浏览器自动化服务
 * 使用 Playwright 实现自主浏览器控制
 *
 * 功能：
 * - 多标签页管理
 * - 智能表单填写
 * - 网页内容提取
 * - 截图与视觉分析
 * - Cookie/会话保持
 *
 * @version 1.0.0
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('BrowserAgent');

import { chromium, Browser, BrowserContext, Page, Cookie } from 'playwright';
import { randomUUID } from 'crypto';

export interface BrowserProfile {
  id: string;
  name: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  cookies?: Cookie[];
  proxy?: { server: string; username?: string; password?: string };
}

export interface WebAction {
  type: 'navigate' | 'wait' | 'click' | 'double_click' | 'type' | 'select' |
        'hover' | 'scroll' | 'screenshot' | 'extract' | 'wait_for_selector' | 'wait_for_navigation';
  selector?: string;
  value?: string | number;
  timeout?: number;
  options?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  extractedText?: string;
  error?: string;
  duration: number;
}

export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  content: string;
  screenshot?: string;
  textContent: string;
  elements: PageElement[];
}

export interface PageElement {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

class BrowserAgent {
  private static instance: BrowserAgent | null = null;

  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private profiles: Map<string, BrowserProfile> = new Map();
  private defaultTimeout = 30000;

  private constructor() {}

  public static getInstance(): BrowserAgent {
    if (!BrowserAgent.instance) {
      BrowserAgent.instance = new BrowserAgent();
    }
    return BrowserAgent.instance;
  }

  /**
   * 初始化浏览器实例
   */
  public async initialize(): Promise<void> {
    if (this.browser) return;

    try {
      this.browser = await chromium.launch({
        headless: process.env.BROWSER_HEADLESS !== 'false',
        executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
        ]
      });

      logger.info('BrowserAgent initialized');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize browser');
      throw error;
    }
  }

  /**
   * 创建浏览器配置文件
   */
  public async createProfile(profile: BrowserProfile): Promise<string> {
    await this.initialize();

    const profileId = profile.id || randomUUID();
    const contextOptions: Record<string, unknown> = {
      viewport: profile.viewport || { width: 1280, height: 800 },
      userAgent: profile.userAgent || undefined,
    };

    if (profile.proxy) {
      contextOptions.proxy = {
        server: profile.proxy.server,
        username: profile.proxy.username,
        password: profile.proxy.password,
      };
    }

    const context = await this.browser!.newContext(contextOptions);

    if (profile.cookies && profile.cookies.length > 0) {
      await context.addCookies(profile.cookies);
    }

    this.contexts.set(profileId, context);
    this.profiles.set(profileId, { ...profile, id: profileId });

    logger.info({ profileId, name: profile.name }, 'Browser profile created');
    return profileId;
  }

  /**
   * 执行一系列网页操作
   */
  public async executeActions(
    profileId: string,
    actions: WebAction[],
    options?: { screenshotEach?: boolean }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const context = this.contexts.get(profileId);

    if (!context) {
      return { success: false, error: 'Profile not found', duration: 0 };
    }

    const page = await context.newPage();
    const screenshots: string[] = [];

    try {
      for (const action of actions) {
        const result = await this.executeAction(page, action);

        if (!result.success) {
          return {
            ...result,
            screenshot: screenshots[screenshots.length - 1],
            duration: Date.now() - startTime,
          };
        }

        if (options?.screenshotEach) {
          const screenshot = Buffer.from(await page.screenshot()).toString('base64');
          screenshots.push(screenshot);
        }
      }

      const finalScreenshot = Buffer.from(await page.screenshot()).toString('base64');

      return {
        success: true,
        screenshot: finalScreenshot,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const screenshotBuffer = await page.screenshot().catch(() => Buffer.alloc(0));
      const screenshot = screenshotBuffer.toString('base64');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        screenshot,
        duration: Date.now() - startTime,
      };

    } finally {
      await page.close();
    }
  }

  /**
   * 执行单个网页操作
   */
  private async executeAction(page: Page, action: WebAction): Promise<Omit<ExecutionResult, 'duration'>> {
    const timeout = action.timeout || this.defaultTimeout;

    try {
      switch (action.type) {
        case 'navigate':
          await page.goto(action.value as string, { timeout, waitUntil: 'domcontentloaded' });
          break;

        case 'wait':
          await page.waitForTimeout(action.value as number);
          break;

        case 'wait_for_selector':
          await page.waitForSelector(action.selector!, { timeout, state: action.options?.state || 'visible' });
          break;

        case 'wait_for_navigation':
          await page.waitForNavigation({ timeout, waitUntil: action.options?.waitUntil || 'domcontentloaded' });
          break;

        case 'click':
          await page.click(action.selector!, { timeout });
          break;

        case 'double_click':
          await page.dblclick(action.selector!, { timeout });
          break;

        case 'type':
          await page.fill(action.selector!, String(action.value));
          break;

        case 'select':
          await page.selectOption(action.selector!, action.value as string | string[]);
          break;

        case 'hover':
          await page.hover(action.selector!, { timeout });
          break;

        case 'scroll':
          await page.evaluate(
            ([selector, value]: [string, number]) => {
              const el = selector ? document.querySelector(selector) : window;
              if (el instanceof Window) {
                el.scrollBy(0, value);
              } else if (el instanceof Element) {
                el.scrollTop += value;
              }
            },
            [action.selector || '', action.value || 500] as [string, number]
          );
          break;

        case 'screenshot':
          const screenshot = Buffer.from(await page.screenshot()).toString('base64');
          return { success: true, screenshot };

        case 'extract':
          const content = await this.extractContent(page, action.selector, action.options?.mode || 'text');
          return { success: true, data: content, extractedText: content };

        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Action failed: ${action.type}`,
      };
    }
  }

  /**
   * 提取页面内容
   */
  private async extractContent(
    page: Page,
    selector?: string,
    mode: 'text' | 'html' | 'json' | 'all' = 'text'
  ): Promise<string> {
    if (!selector) {
      const content: Record<string, string> = {
        text: await page.textContent('body'),
        html: await page.content(),
      };
      return mode === 'all' ? JSON.stringify(content) : content[mode];
    }

    const element = await page.$(selector);
    if (!element) return '';

    switch (mode) {
      case 'text':
        return await element.textContent() || '';
      case 'html':
        return await element.innerHTML();
      case 'json':
        const jsonData = await element.evaluate(el => {
          return {
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim(),
            attributes: Object.fromEntries(
              Array.from(el.attributes).map(a => [a.name, a.value])
            ),
            boundingBox: el.getBoundingClientRect(),
          };
        });
        return JSON.stringify(jsonData);
      default:
        return await element.textContent() || '';
    }
  }

  /**
   * 获取页面快照（用于AI分析）
   */
  public async getPageSnapshot(profileId: string, url: string): Promise<PageSnapshot> {
    const context = this.contexts.get(profileId);
    if (!context) throw new Error('Profile not found');

    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });

      const screenshot = Buffer.from(await page.screenshot()).toString('base64');
      const textContent = await page.textContent('body') || '';

      const elements = await page.evaluate(() => {
        const importantTags = ['input', 'button', 'a', 'select', 'textarea', 'form'];
        const els = document.querySelectorAll(importantTags.join(','));

        return Array.from(els).slice(0, 100).map(el => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className || undefined,
          text: el.textContent?.trim().substring(0, 100),
          attributes: Object.fromEntries(
            Array.from(el.attributes)
              .filter(a => !['style', 'class'].includes(a.name))
              .map(a => [a.name, a.value])
          ),
          boundingBox: el.getBoundingClientRect(),
        }));
      });

      return {
        url: page.url(),
        title: await page.title(),
        html: await page.content(),
        content: textContent,
        screenshot,
        textContent,
        elements,
      };

    } finally {
      await page.close();
    }
  }

  /**
   * 智能表单填写
   */
  public async fillForm(
    profileId: string,
    url: string,
    formData: Record<string, string>,
    options?: { submitSelector?: string; waitForNavigation?: boolean }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    const actions: WebAction[] = [
      { type: 'navigate', value: url },
      { type: 'wait_for_navigation', options: { waitUntil: 'domcontentloaded' } },
    ];

    for (const [field, value] of Object.entries(formData)) {
      const selector = this.guessFieldSelector(field);
      if (selector) {
        actions.push({ type: 'wait_for_selector', selector, timeout: 5000 });
        actions.push({ type: 'type', selector, value });
      }
    }

    if (options?.submitSelector) {
      actions.push({ type: 'click', selector: options.submitSelector });
      if (options.waitForNavigation) {
        actions.push({ type: 'wait_for_navigation', options: { waitUntil: 'networkidle' } });
      }
    }

    return this.executeActions(profileId, actions);
  }

  /**
   * 猜测字段选择器
   */
  private guessFieldSelector(fieldName: string): string | undefined {
    const normalized = fieldName.toLowerCase().replace(/[\s_]/g, '');

    const selectors: [string, string][] = [
      [`[name="${normalized}"]`, normalized],
      [`[id*="${normalized}"]`, normalized],
      [`[placeholder*="${fieldName}"]`, fieldName],
      [`[aria-label*="${fieldName}"]`, fieldName],
      [`label:has-text("${fieldName}") + input`, fieldName],
      [`td:has-text("${fieldName}") + td input`, fieldName],
    ];

    for (const [selector] of selectors) {
      if (selector) return selector;
    }

    return undefined;
  }

  /**
   * 更新Profile的Cookies
   */
  public async updateProfileCookies(profileId: string): Promise<Cookie[]> {
    const context = this.contexts.get(profileId);
    if (!context) throw new Error('Profile not found');

    const cookies = await context.cookies();
    const profile = this.profiles.get(profileId);

    if (profile) {
      profile.cookies = cookies;
      this.profiles.set(profileId, profile);
    }

    return cookies;
  }

  /**
   * 删除Profile
   */
  public async deleteProfile(profileId: string): Promise<void> {
    const context = this.contexts.get(profileId);
    if (context) {
      await context.close();
      this.contexts.delete(profileId);
    }
    this.profiles.delete(profileId);

    logger.info({ profileId }, 'Browser profile deleted');
  }

  /**
   * 关闭所有资源
   */
  public async shutdown(): Promise<void> {
    for (const context of Array.from(this.contexts.values())) {
      await context.close();
    }
    this.contexts.clear();
    this.profiles.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('BrowserAgent shutdown');
  }

  /**
   * 获取统计信息
   */
  public getStats(): { activeProfiles: number; totalContexts: number } {
    return {
      activeProfiles: this.profiles.size,
      totalContexts: this.contexts.size,
    };
  }
}

export const browserAgent = BrowserAgent.getInstance();
export default browserAgent;
