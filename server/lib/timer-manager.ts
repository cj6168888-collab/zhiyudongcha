import { createServiceLogger } from './logger';

const logger = createServiceLogger('TimerManager');

export interface TimerInfo {
  name: string;
  type: 'interval' | 'timeout';
  intervalMs?: number;
  createdAt: Date;
  executionCount: number;
  lastExecutionAt?: Date;
}

export class TimerManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private timerInfo: Map<string, TimerInfo> = new Map();
  private isShutdown = false;

  setInterval(name: string, callback: () => void, ms: number): void {
    if (this.isShutdown) {
      logger.warn({ timer: name }, 'TimerManager is shutdown, ignoring setInterval');
      return;
    }

    this.clearInterval(name);
    
    const wrappedCallback = () => {
      const info = this.timerInfo.get(name);
      if (info) {
        info.executionCount++;
        info.lastExecutionAt = new Date();
      }
      
      try {
        callback();
      } catch (error) {
        logger.error({ timer: name, error }, 'Interval callback error');
      }
    };
    
    const id = setInterval(wrappedCallback, ms);
    this.intervals.set(name, id);
    this.timerInfo.set(name, {
      name,
      type: 'interval',
      intervalMs: ms,
      createdAt: new Date(),
      executionCount: 0,
    });
    
    logger.debug({ timer: name, intervalMs: ms }, 'Interval created');
  }

  setTimeout(name: string, callback: () => void, ms: number): void {
    if (this.isShutdown) {
      logger.warn({ timer: name }, 'TimerManager is shutdown, ignoring setTimeout');
      return;
    }

    this.clearTimeout(name);
    
    const wrappedCallback = () => {
      const info = this.timerInfo.get(name);
      if (info) {
        info.executionCount++;
        info.lastExecutionAt = new Date();
      }
      
      this.timeouts.delete(name);
      this.timerInfo.delete(name);
      
      try {
        callback();
      } catch (error) {
        logger.error({ timer: name, error }, 'Timeout callback error');
      }
    };
    
    const id = setTimeout(wrappedCallback, ms);
    this.timeouts.set(name, id);
    this.timerInfo.set(name, {
      name,
      type: 'timeout',
      intervalMs: ms,
      createdAt: new Date(),
      executionCount: 0,
    });
    
    logger.debug({ timer: name, delayMs: ms }, 'Timeout created');
  }

  clearInterval(name: string): void {
    const id = this.intervals.get(name);
    if (id) {
      clearInterval(id);
      this.intervals.delete(name);
      this.timerInfo.delete(name);
      logger.debug({ timer: name }, 'Interval cleared');
    }
  }

  clearTimeout(name: string): void {
    const id = this.timeouts.get(name);
    if (id) {
      clearTimeout(id);
      this.timeouts.delete(name);
      this.timerInfo.delete(name);
      logger.debug({ timer: name }, 'Timeout cleared');
    }
  }

  clearAll(): void {
    this.intervals.forEach((id, name) => {
      clearInterval(id);
      logger.debug({ timer: name }, 'Interval cleared');
    });
    
    this.timeouts.forEach((id, name) => {
      clearTimeout(id);
      logger.debug({ timer: name }, 'Timeout cleared');
    });
    
    const count = this.intervals.size + this.timeouts.size;
    this.intervals.clear();
    this.timeouts.clear();
    this.timerInfo.clear();
    
    logger.info({ count }, 'All timers cleared');
  }

  hasInterval(name: string): boolean {
    return this.intervals.has(name);
  }

  hasTimeout(name: string): boolean {
    return this.timeouts.has(name);
  }

  getActiveTimers(): TimerInfo[] {
    return Array.from(this.timerInfo.values());
  }

  getStats(): { intervals: number; timeouts: number; total: number } {
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      total: this.intervals.size + this.timeouts.size,
    };
  }

  shutdown(): void {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.clearAll();
    
    logger.info('TimerManager shutdown complete');
  }
}

export const timerManager = new TimerManager();

process.on('SIGTERM', () => {
  timerManager.shutdown();
});

process.on('SIGINT', () => {
  timerManager.shutdown();
});
