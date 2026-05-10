import { createServiceLogger } from './logger';

const logger = createServiceLogger('ImprovedTimerManager');

interface TimerInfo {
  id: NodeJS.Timeout;
  name: string;
  type: 'interval' | 'timeout';
  createdAt: number;
  callback: () => void;
}

class ImprovedTimerManager {
  private timers: Map<string, TimerInfo> = new Map();
  private isShutdown = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxTimerAge = 24 * 60 * 60 * 1000; // 24小时

  constructor() {
    // 定期清理过期定时器
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTimers();
    }, 60 * 60 * 1000); // 每小时清理一次

    // 注册进程退出处理
    process.on('exit', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  setInterval(name: string, callback: () => void, ms: number): void {
    if (this.isShutdown) {
      logger.warn({ timer: name }, 'TimerManager已关闭，忽略setInterval');
      return;
    }

    // 清理已存在的同名定时器
    this.clearTimer(name);

    const wrappedCallback = () => {
      try {
        callback();
      } catch (error) {
        logger.error({ timer: name, error }, '定时器回调执行错误');
      }
    };

    const id = setInterval(wrappedCallback, ms);
    
    this.timers.set(name, {
      id,
      name,
      type: 'interval',
      createdAt: Date.now(),
      callback: wrappedCallback,
    });

    logger.debug({ timer: name, interval: ms }, '注册interval定时器');
  }

  setTimeout(name: string, callback: () => void, ms: number): NodeJS.Timeout {
    if (this.isShutdown) {
      logger.warn({ timer: name }, 'TimerManager已关闭，忽略setTimeout');
      return setTimeout(() => {}, 0); // 返回一个空的定时器
    }

    const wrappedCallback = () => {
      try {
        callback();
      } catch (error) {
        logger.error({ timer: name, error }, '定时器回调执行错误');
      } finally {
        // 自动清理timeout定时器
        this.timers.delete(name);
      }
    };

    const id = setTimeout(wrappedCallback, ms);
    
    this.timers.set(name, {
      id,
      name,
      type: 'timeout',
      createdAt: Date.now(),
      callback: wrappedCallback,
    });

    logger.debug({ timer: name, timeout: ms }, '注册setTimeout定时器');
    return id;
  }

  clearTimer(name: string): boolean {
    const timerInfo = this.timers.get(name);
    if (!timerInfo) {
      return false;
    }

    if (timerInfo.type === 'interval') {
      clearInterval(timerInfo.id);
    } else {
      clearTimeout(timerInfo.id);
    }

    this.timers.delete(name);
    logger.debug({ timer: name }, '清除定时器');
    return true;
  }

  clearAllTimers(): void {
    const timerNames = Array.from(this.timers.keys());
    for (const name of timerNames) {
      this.clearTimer(name);
    }
    logger.info('清除所有定时器');
  }

  private cleanupExpiredTimers(): void {
    const now = Date.now();
    const expiredTimers: string[] = [];

    for (const [name, timerInfo] of this.timers.entries()) {
      if (now - timerInfo.createdAt > this.maxTimerAge) {
        expiredTimers.push(name);
      }
    }

    for (const name of expiredTimers) {
      logger.warn({ timer: name }, '清理过期定时器');
      this.clearTimer(name);
    }

    if (expiredTimers.length > 0) {
      logger.info({ count: expiredTimers.length }, '清理过期定时器完成');
    }
  }

  getStats(): {
    total: number;
    intervals: number;
    timeouts: number;
    oldestTimer: number | null;
  } {
    const timers = Array.from(this.timers.values());
    const now = Date.now();
    
    const intervals = timers.filter(t => t.type === 'interval').length;
    const timeouts = timers.filter(t => t.type === 'timeout').length;
    const oldestTimer = timers.length > 0 
      ? Math.min(...timers.map(t => t.createdAt))
      : null;

    return {
      total: timers.length,
      intervals,
      timeouts,
      oldestTimer: oldestTimer ? now - oldestTimer : null,
    };
  }

  listTimers(): Array<{ name: string; type: string; age: number }> {
    const now = Date.now();
    return Array.from(this.timers.values()).map(timer => ({
      name: timer.name,
      type: timer.type,
      age: now - timer.createdAt,
    }));
  }

  shutdown(): void {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    
    // 清理所有定时器
    this.clearAllTimers();
    
    // 清理清理定时器本身
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    logger.info('TimerManager已关闭');
  }

  // 检测潜在的内存泄漏
  detectMemoryLeaks(): Array<{ timer: string; issue: string }> {
    const issues: Array<{ timer: string; issue: string }> = [];
    const timers = Array.from(this.timers.values());
    const now = Date.now();

    // 检测长期运行的interval定时器
    for (const timer of timers) {
      if (timer.type === 'interval') {
        const age = now - timer.createdAt;
        if (age > 6 * 60 * 60 * 1000) { // 6小时
          issues.push({
            timer: timer.name,
            issue: `interval定时器运行时间过长: ${Math.round(age / 60 / 60 / 1000)}小时`,
          });
        }
      }
    }

    // 检测同类型定时器数量
    const timerCounts = new Map<string, number>();
    for (const timer of timers) {
      const baseName = timer.name.replace(/\d+$/, ''); // 移除末尾数字
      timerCounts.set(baseName, (timerCounts.get(baseName) || 0) + 1);
    }

    for (const [name, count] of timerCounts.entries()) {
      if (count > 5) {
        issues.push({
          timer: name,
          issue: `同类型定时器数量过多: ${count}`,
        });
      }
    }

    return issues;
  }
}

// 创建单例实例
export const improvedTimerManager = new ImprovedTimerManager();

// 向后兼容的导出
export const timerManager = improvedTimerManager;

// 定期内存泄漏检测
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const leaks = improvedTimerManager.detectMemoryLeaks();
    if (leaks.length > 0) {
      logger.warn({ leaks }, '检测到潜在内存泄漏');
    }
  }, 30 * 60 * 1000); // 每30分钟检测一次
}