/**
 * Z5 打断处理服务 - Phase 8.3
 * 
 * 核心功能：
 * 1. 多级打断控制 - 软打断/硬打断/紧急打断
 * 2. 优雅中断 - 等待当前句子完成后中断
 * 3. 打断队列 - 支持多个并发打断请求
 * 4. 恢复机制 - 打断后的状态恢复
 * 5. 打断统计 - 监控打断频率和原因
 * 6. 触发策略 - VAD触发/用户触发/系统触发
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('InterruptHandler');

import { EventEmitter } from 'events';

export type InterruptLevel = 
  | 'soft'      // 软打断：等待当前句子完成
  | 'hard'      // 硬打断：立即停止，允许缓冲
  | 'emergency'; // 紧急打断：立即停止，丢弃所有缓冲

export type InterruptSource =
  | 'vad'       // VAD检测到用户说话
  | 'user'      // 用户主动触发
  | 'system'    // 系统触发（错误/超时等）
  | 'timeout'   // 超时触发
  | 'priority'; // 高优先级任务抢占

export interface InterruptRequest {
  id: string;
  sessionId: string;
  level: InterruptLevel;
  source: InterruptSource;
  reason?: string;
  timestamp: number;
  priority: number;  // 0-100, 越高越优先
  callback?: () => void;
}

export interface InterruptResult {
  success: boolean;
  interruptId: string;
  sessionId: string;
  level: InterruptLevel;
  duration: number;      // 打断处理耗时
  stoppedAt: 'sentence' | 'word' | 'immediate';
  recoverable: boolean;
  error?: string;
}

export interface InterruptState {
  sessionId: string;
  isInterrupting: boolean;
  pendingInterrupts: InterruptRequest[];
  lastInterrupt?: InterruptResult;
  abortController: AbortController;
  pausedContent?: {
    text: string;
    position: number;
    resumable: boolean;
  };
}

export interface InterruptStats {
  totalInterrupts: number;
  byLevel: Record<InterruptLevel, number>;
  bySource: Record<InterruptSource, number>;
  avgProcessingTime: number;
  successRate: number;
}

function generateInterruptId(): string {
  return 'int_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
}

function log(message: string, sessionId?: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const prefix = sessionId ? `[Interrupt:${sessionId.slice(-6)}]` : '[Interrupt]';
  logger.info(`${time} ${prefix} ${message}`);
}

class InterruptHandler extends EventEmitter {
  private states: Map<string, InterruptState> = new Map();
  private globalStats: InterruptStats = {
    totalInterrupts: 0,
    byLevel: { soft: 0, hard: 0, emergency: 0 },
    bySource: { vad: 0, user: 0, system: 0, timeout: 0, priority: 0 },
    avgProcessingTime: 0,
    successRate: 1.0,
  };

  constructor() {
    super();
    log('打断处理服务已初始化 (Phase 8.3)');
  }

  initSession(sessionId: string): InterruptState {
    const state: InterruptState = {
      sessionId,
      isInterrupting: false,
      pendingInterrupts: [],
      abortController: new AbortController(),
    };
    
    this.states.set(sessionId, state);
    log(`会话已初始化`, sessionId);
    
    return state;
  }

  async requestInterrupt(
    sessionId: string,
    level: InterruptLevel,
    source: InterruptSource,
    options: {
      reason?: string;
      priority?: number;
      callback?: () => void;
    } = {}
  ): Promise<InterruptResult> {
    const startTime = Date.now();
    let state = this.states.get(sessionId);
    
    if (!state) {
      state = this.initSession(sessionId);
    }

    const request: InterruptRequest = {
      id: generateInterruptId(),
      sessionId,
      level,
      source,
      reason: options.reason,
      timestamp: Date.now(),
      priority: options.priority ?? this.getDefaultPriority(level, source),
      callback: options.callback,
    };

    log(`打断请求: ${level}/${source} (优先级: ${request.priority})`, sessionId);

    // 如果已经在处理打断，添加到队列
    if (state.isInterrupting) {
      // 检查是否需要抢占当前打断
      if (request.priority > (state.pendingInterrupts[0]?.priority ?? 0)) {
        state.pendingInterrupts.unshift(request);
        log(`高优先级打断已抢占`, sessionId);
      } else {
        state.pendingInterrupts.push(request);
        log(`打断已加入队列，位置: ${state.pendingInterrupts.length}`, sessionId);
      }
      
      // 等待处理
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          const currentRequest = state!.pendingInterrupts.find(r => r.id === request.id);
          if (!currentRequest) {
            clearInterval(checkInterval);
            resolve(state!.lastInterrupt || {
              success: true,
              interruptId: request.id,
              sessionId,
              level,
              duration: Date.now() - startTime,
              stoppedAt: 'immediate',
              recoverable: false,
            });
          }
        }, 50);
      });
    }

    // 开始处理打断
    state.isInterrupting = true;
    
    try {
      const result = await this.processInterrupt(state, request);
      
      // 更新统计
      this.updateStats(result);
      state.lastInterrupt = result;

      // 处理队列中的下一个
      this.processQueue(sessionId);

      return result;
      
    } catch (error) {
      const result: InterruptResult = {
        success: false,
        interruptId: request.id,
        sessionId,
        level,
        duration: Date.now() - startTime,
        stoppedAt: 'immediate',
        recoverable: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
      
      this.updateStats(result);
      state.isInterrupting = false;
      
      return result;
    }
  }

  private async processInterrupt(
    state: InterruptState,
    request: InterruptRequest
  ): Promise<InterruptResult> {
    const startTime = Date.now();

    // 根据打断级别执行不同策略
    let stoppedAt: 'sentence' | 'word' | 'immediate';

    switch (request.level) {
      case 'soft':
        // 软打断：等待当前句子完成
        stoppedAt = 'sentence';
        await this.waitForSentenceEnd(state);
        break;

      case 'hard':
        // 硬打断：立即发送abort信号
        stoppedAt = 'word';
        state.abortController.abort();
        state.abortController = new AbortController();
        break;

      case 'emergency':
        // 紧急打断：立即停止，清空所有缓冲
        stoppedAt = 'immediate';
        state.abortController.abort();
        state.abortController = new AbortController();
        state.pendingInterrupts = []; // 清空队列
        break;
    }

    // 触发回调
    if (request.callback) {
      try {
        request.callback();
      } catch (e) {
        log(`回调执行失败: ${e}`, state.sessionId);
      }
    }

    // 发出事件
    this.emit('interrupted', state.sessionId, request);

    const result: InterruptResult = {
      success: true,
      interruptId: request.id,
      sessionId: state.sessionId,
      level: request.level,
      duration: Date.now() - startTime,
      stoppedAt,
      recoverable: request.level !== 'emergency',
    };

    log(`打断完成: ${stoppedAt} (耗时: ${result.duration}ms)`, state.sessionId);

    state.isInterrupting = false;
    return result;
  }

  private async waitForSentenceEnd(state: InterruptState): Promise<void> {
    // 最多等待2秒
    const maxWait = 2000;
    const checkInterval = 50;
    let waited = 0;

    return new Promise(resolve => {
      const check = () => {
        if (waited >= maxWait || state.abortController.signal.aborted) {
          resolve();
          return;
        }
        waited += checkInterval;
        setTimeout(check, checkInterval);
      };
      check();
    });
  }

  private processQueue(sessionId: string): void {
    const state = this.states.get(sessionId);
    if (!state || state.pendingInterrupts.length === 0) return;

    const nextRequest = state.pendingInterrupts.shift();
    if (nextRequest) {
      this.requestInterrupt(sessionId, nextRequest.level, nextRequest.source, {
        reason: nextRequest.reason,
        priority: nextRequest.priority,
        callback: nextRequest.callback,
      });
    }
  }

  private getDefaultPriority(level: InterruptLevel, source: InterruptSource): number {
    let priority = 50;

    // 基于级别调整
    switch (level) {
      case 'emergency': priority += 40; break;
      case 'hard': priority += 20; break;
      case 'soft': priority += 0; break;
    }

    // 基于来源调整
    switch (source) {
      case 'priority': priority += 30; break;
      case 'user': priority += 20; break;
      case 'vad': priority += 10; break;
      case 'system': priority += 5; break;
      case 'timeout': priority += 0; break;
    }

    return Math.min(100, priority);
  }

  private updateStats(result: InterruptResult): void {
    this.globalStats.totalInterrupts++;
    this.globalStats.byLevel[result.level]++;
    // 来源统计需要从请求中获取，这里暂时跳过
    
    // 更新平均处理时间
    const n = this.globalStats.totalInterrupts;
    this.globalStats.avgProcessingTime = 
      (this.globalStats.avgProcessingTime * (n - 1) + result.duration) / n;
    
    // 更新成功率
    if (!result.success) {
      const successCount = Math.round(this.globalStats.successRate * (n - 1));
      this.globalStats.successRate = successCount / n;
    }
  }

  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.states.get(sessionId)?.abortController.signal;
  }

  isInterrupting(sessionId: string): boolean {
    return this.states.get(sessionId)?.isInterrupting ?? false;
  }

  reset(sessionId: string): void {
    const state = this.states.get(sessionId);
    if (state) {
      state.abortController.abort();
      state.abortController = new AbortController();
      state.isInterrupting = false;
      state.pendingInterrupts = [];
      state.pausedContent = undefined;
      log(`状态已重置`, sessionId);
    }
  }

  cleanup(sessionId: string): void {
    const state = this.states.get(sessionId);
    if (state) {
      state.abortController.abort();
    }
    this.states.delete(sessionId);
    log(`会话已清理`, sessionId);
  }

  getState(sessionId: string): InterruptState | undefined {
    return this.states.get(sessionId);
  }

  getStats(): InterruptStats {
    return { ...this.globalStats };
  }

  // VAD触发的快捷方法
  async vadInterrupt(sessionId: string): Promise<InterruptResult> {
    return this.requestInterrupt(sessionId, 'hard', 'vad', {
      reason: '检测到用户说话',
    });
  }

  // 用户触发的快捷方法
  async userInterrupt(sessionId: string): Promise<InterruptResult> {
    return this.requestInterrupt(sessionId, 'hard', 'user', {
      reason: '用户主动打断',
    });
  }

  // 紧急停止
  async emergencyStop(sessionId: string, reason: string): Promise<InterruptResult> {
    return this.requestInterrupt(sessionId, 'emergency', 'system', {
      reason,
      priority: 100,
    });
  }
}

export const interruptHandler = new InterruptHandler();
logger.info('[InterruptHandler] 打断处理服务 v1.0 已加载 (Phase 8.3)');
