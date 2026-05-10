/**
 * WebsiteMonitorService - 网站后台监控服务
 *
 * 功能：
 * - 登录并保持会话
 * - 定时检查网站更新
 * - 检测新回复/通知
 * - 智能提取关键信息
 * - 自动告警通知
 *
 * @version 1.0.0
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('WebsiteMonitorService');

import { browserAgent, type WebAction, type ExecutionResult } from './BrowserAgent';
import { randomUUID } from 'crypto';
import * as cron from 'node-cron';

export interface WebsiteCredential {
  websiteId: string;
  url: string;
  username: string;
  password: string;
  twoFactorCallback?: () => Promise<string>;
}

export interface CheckPattern {
  id: string;
  name: string;
  selector: string;
  type: 'new' | 'changed' | 'contains' | 'appears';
  keywords?: string[];
  expectedValue?: string;
}

export interface MonitorConfig {
  id: string;
  name: string;
  websiteId: string;
  profileId: string;

  // 检查配置
  checkInterval: string;  // CRON 表达式，如 "0 */4 * * *"
  enabled: boolean;

  // 登录步骤
  loginSteps: WebAction[];
  afterLoginWait?: number;

  // 导航步骤
  navigateSteps: WebAction[];

  // 检查模式
  patterns: CheckPattern[];

  // 通知配置
  notifyOnMatch: boolean;
  notifyChannels: ('app' | 'email' | 'sms')[];
  notifyTemplate?: string;

  // 提取配置
  extractFields?: {
    name: string;
    selector: string;
    type: 'text' | 'link' | 'status' | 'date';
  }[];
}

export interface CheckResult {
  configId: string;
  timestamp: Date;
  hasUpdates: boolean;
  matches: PatternMatch[];
  extractedData?: Record<string, string>;
  screenshot?: string;
  error?: string;
}

export interface PatternMatch {
  patternId: string;
  patternName: string;
  matchType: 'new' | 'changed' | 'contains' | 'appears';
  oldValue?: string;
  newValue: string;
  timestamp: Date;
}

export interface MonitorSession {
  configId: string;
  profileId: string;
  lastCheck: Date;
  lastResult?: CheckResult;
  isRunning: boolean;
}

class WebsiteMonitorService {
  private configs: Map<string, MonitorConfig> = new Map();
  private sessions: Map<string, MonitorSession> = new Map();
  private credentials: Map<string, WebsiteCredential> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private lastCheckData: Map<string, Map<string, string>> = new Map();

  private notificationCallback?: (
    type: string,
    title: string,
    body: string,
    data?: unknown
  ) => Promise<void>;

  /**
   * 设置通知回调
   */
  public setNotificationCallback(
    callback: (type: string, title: string, body: string, data?: unknown) => Promise<void>
  ): void {
    this.notificationCallback = callback;
  }

  /**
   * 注册网站凭证
   */
  public registerCredential(credential: WebsiteCredential): void {
    this.credentials.set(credential.websiteId, credential);
    logger.info({ websiteId: credential.websiteId, url: credential.url }, 'Credential registered');
  }

  /**
   * 添加监控配置
   */
  public addMonitorConfig(config: MonitorConfig): void {
    this.configs.set(config.id, config);

    // 如果启用，立即开始调度
    if (config.enabled) {
      this.startScheduler(config.id);
    }

    // 初始化上次检查数据
    this.lastCheckData.set(config.id, new Map());

    logger.info({ configId: config.id, name: config.name, interval: config.checkInterval }, 'Monitor config added');
  }

  /**
   * 更新监控配置
   */
  public updateMonitorConfig(configId: string, updates: Partial<MonitorConfig>): void {
    const config = this.configs.get(configId);
    if (!config) return;

    const updated = { ...config, ...updates };
    this.configs.set(configId, updated);

    // 如果调度状态改变，更新调度器
    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        this.startScheduler(configId);
      } else {
        this.stopScheduler(configId);
      }
    }

    logger.info({ configId }, 'Monitor config updated');
  }

  /**
   * 开始调度任务
   */
  private startScheduler(configId: string): void {
    const config = this.configs.get(configId);
    if (!config) return;

    // 停止现有调度
    this.stopScheduler(configId);

    try {
      const job = cron.schedule(config.checkInterval, async () => {
        await this.executeCheck(configId);
      }, {
        timezone: 'Asia/Shanghai',
        scheduled: true,
      });

      this.cronJobs.set(configId, job);
      logger.info({ configId, interval: config.checkInterval }, 'Scheduler started');
    } catch (error) {
      logger.error({ configId, err: error }, 'Failed to start scheduler');
    }
  }

  /**
   * 停止调度任务
   */
  private stopScheduler(configId: string): void {
    const job = this.cronJobs.get(configId);
    if (job) {
      job.stop();
      this.cronJobs.delete(configId);
      logger.info({ configId }, 'Scheduler stopped');
    }
  }

  /**
   * 执行检查
   */
  public async executeCheck(configId: string): Promise<CheckResult> {
    const config = this.configs.get(configId);
    if (!config) {
      return { configId, timestamp: new Date(), hasUpdates: false, matches: [], error: 'Config not found' };
    }

    const session = this.sessions.get(configId) || {
      configId,
      profileId: config.profileId,
      lastCheck: new Date(0),
      isRunning: false,
    };

    if (session.isRunning) {
      logger.warn({ configId }, 'Check already running, skipping');
      return session.lastResult || { configId, timestamp: new Date(), hasUpdates: false, matches: [] };
    }

    session.isRunning = true;
    this.sessions.set(configId, session);

    const result: CheckResult = {
      configId,
      timestamp: new Date(),
      hasUpdates: false,
      matches: [],
    };

    try {
      // 1. 确保登录
      await this.ensureLogin(config);

      // 2. 执行导航步骤
      const navResult = await browserAgent.executeActions(config.profileId, config.navigateSteps);
      if (!navResult.success) {
        result.error = `Navigation failed: ${navResult.error}`;
        return result;
      }

      // 等待页面稳定
      if (config.afterLoginWait) {
        await new Promise(r => setTimeout(r, config.afterLoginWait));
      }

      // 3. 检查每个模式
      const lastData = this.lastCheckData.get(configId) || new Map();
      const newData = new Map<string, string>();

      for (const pattern of config.patterns) {
        const match = await this.checkPattern(config.profileId, pattern, lastData.get(pattern.id));

        if (match) {
          result.matches.push(match);
          result.hasUpdates = true;
        }

        // 获取当前值并保存
        const currentValue = await this.getElementValue(config.profileId, pattern.selector, pattern.type);
        if (currentValue !== undefined) {
          newData.set(pattern.id, currentValue);
        }
      }

      // 更新保存的数据
      this.lastCheckData.set(configId, newData);

      // 4. 提取额外字段
      if (config.extractFields) {
        result.extractedData = await this.extractFields(config.profileId, config.extractFields);
      }

      // 5. 截图
      const screenshotResult = await browserAgent.executeActions(config.profileId, [
        { type: 'screenshot' }
      ]);
      result.screenshot = screenshotResult.screenshot;

      // 6. 发送通知
      if (result.hasUpdates && config.notifyOnMatch) {
        await this.sendNotification(config, result);
      }

      session.lastCheck = new Date();
      session.lastResult = result;

      logger.info({
        configId,
        hasUpdates: result.hasUpdates,
        matchCount: result.matches.length
      }, 'Check completed');

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ configId, err: error }, 'Check failed');
    } finally {
      session.isRunning = false;
      this.sessions.set(configId, session);
    }

    return result;
  }

  /**
   * 确保已登录
   */
  private async ensureLogin(config: MonitorConfig): Promise<void> {
    const credential = this.credentials.get(config.websiteId);
    if (!credential) return;

    // 尝试执行登录步骤
    const loginResult = await browserAgent.executeActions(config.profileId, config.loginSteps);

    if (loginResult.success) {
      await browserAgent.updateProfileCookies(config.profileId);
    }
  }

  /**
   * 检查单个模式
   */
  private async checkPattern(
    profileId: string,
    pattern: CheckPattern,
    lastValue?: string
  ): Promise<PatternMatch | null> {
    const currentValue = await this.getElementValue(profileId, pattern.selector, 'text');

    if (currentValue === undefined || currentValue === '') {
      return null;
    }

    let isMatch = false;

    switch (pattern.type) {
      case 'new':
        isMatch = lastValue === undefined && currentValue !== '';
        break;

      case 'changed':
        isMatch = lastValue !== undefined && currentValue !== lastValue;
        break;

      case 'contains':
        isMatch = pattern.keywords?.some(kw => currentValue.includes(kw)) || false;
        break;

      case 'appears':
        // 检查元素是否出现（通过判断值是否有变化）
        isMatch = currentValue !== '';
        break;
    }

    if (!isMatch) {
      return null;
    }

    return {
      patternId: pattern.id,
      patternName: pattern.name,
      matchType: pattern.type,
      oldValue: lastValue,
      newValue: currentValue,
      timestamp: new Date(),
    };
  }

  /**
   * 获取元素值
   */
  private async getElementValue(
    profileId: string,
    selector: string,
    type: 'text' | 'link' | 'status' | 'date'
  ): Promise<string | undefined> {
    try {
      const result = await browserAgent.executeActions(profileId, [
        { type: 'extract', selector, options: { mode: 'text' } }
      ]);
      return result.extractedText?.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * 提取多个字段
   */
  private async extractFields(
    profileId: string,
    fields: MonitorConfig['extractFields']
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const field of fields || []) {
      const value = await this.getElementValue(profileId, field.selector, field.type);
      if (value !== undefined) {
        result[field.name] = value;
      }
    }

    return result;
  }

  /**
   * 发送通知
   */
  private async sendNotification(config: MonitorConfig, result: CheckResult): Promise<void> {
    if (!this.notificationCallback) return;

    const title = `${config.name} - 检测到更新`;

    const body = result.matches
      .map(m => `• ${m.patternName}: ${m.newValue}`)
      .join('\n');

    const data = {
      configId: config.id,
      matches: result.matches,
      extractedData: result.extractedData,
      timestamp: result.timestamp,
    };

    for (const channel of config.notifyChannels) {
      await this.notificationCallback(channel, title, body, data);
    }
  }

  /**
   * 手动触发检查
   */
  public async triggerCheck(configId: string): Promise<CheckResult> {
    return this.executeCheck(configId);
  }

  /**
   * 获取监控状态
   */
  public getMonitorStatus(configId: string): MonitorSession | undefined {
    return this.sessions.get(configId);
  }

  /**
   * 获取所有监控配置
   */
  public getAllConfigs(): MonitorConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 删除监控配置
   */
  public deleteConfig(configId: string): void {
    this.stopScheduler(configId);
    this.configs.delete(configId);
    this.sessions.delete(configId);
    this.lastCheckData.delete(configId);

    logger.info({ configId }, 'Monitor config deleted');
  }

  /**
   * 暂停所有监控
   */
  public pauseAll(): void {
    for (const configId of this.configs.keys()) {
      this.stopScheduler(configId);
    }
    logger.info('All monitors paused');
  }

  /**
   * 恢复所有监控
   */
  public resumeAll(): void {
    for (const [configId, config] of this.configs) {
      if (config.enabled) {
        this.startScheduler(configId);
      }
    }
    logger.info('All monitors resumed');
  }

  /**
   * 关闭服务
   */
  public shutdown(): void {
    this.pauseAll();
    this.configs.clear();
    this.sessions.clear();
    this.lastCheckData.clear();
    this.credentials.clear();

    logger.info('WebsiteMonitorService shutdown');
  }
}

// 导出单例
export const websiteMonitorService = new WebsiteMonitorService();
export default websiteMonitorService;
