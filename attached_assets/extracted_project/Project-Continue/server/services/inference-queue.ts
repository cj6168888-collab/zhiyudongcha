/**
 * 小智 Inference Queue - 推理任务队列
 * 
 * 功能：
 * 1. 管理AI推理任务的优先级队列
 * 2. 支持任务重试和超时处理
 * 3. 跨设备任务分发
 * 4. 断线续传支持
 */

import { EventEmitter } from 'events';

// ===== 任务类型 =====
export type JobType = 'CHAT' | 'EXPERT_ANALYSIS' | 'MULTI_EXPERT' | 'SYNTHESIS' | 'EMBEDDING';
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
export type JobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

export interface InferenceJob {
  id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  
  // 任务内容
  input: {
    messages?: Array<{ role: string; content: string }>;
    userMessage: string;
    context?: string;
    expertType?: string;
  };
  
  // 执行配置
  config: {
    preferLocal: boolean;
    maxRetries: number;
    timeoutMs: number;
    targetDevice?: string;  // 指定设备执行
  };
  
  // 状态追踪
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  
  // 结果
  result?: {
    message: string;
    provider: string;
    model: string;
    latencyMs: number;
    chainOfThought?: any;
  };
  error?: string;
  
  // 来源追踪
  userId?: string;
  deviceId?: string;
  sessionId?: string;
}

// ===== 优先级权重 =====
const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  CRITICAL: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  BACKGROUND: 10,
};

// ===== 默认超时时间 =====
const DEFAULT_TIMEOUTS: Record<JobType, number> = {
  CHAT: 30000,          // 30秒
  EXPERT_ANALYSIS: 60000, // 1分钟
  MULTI_EXPERT: 120000,   // 2分钟
  SYNTHESIS: 90000,       // 1.5分钟
  EMBEDDING: 10000,       // 10秒
};

// ===== 推理队列类 =====
export class InferenceQueue extends EventEmitter {
  private queue: Map<string, InferenceJob> = new Map();
  private processing: Set<string> = new Set();
  private maxConcurrent: number = 3;
  private isProcessing: boolean = false;
  
  constructor(maxConcurrent: number = 3) {
    super();
    this.maxConcurrent = maxConcurrent;
  }
  
  // 生成任务ID
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // 添加任务
  addJob(
    type: JobType,
    input: InferenceJob['input'],
    options: {
      priority?: JobPriority;
      preferLocal?: boolean;
      maxRetries?: number;
      targetDevice?: string;
      userId?: string;
      deviceId?: string;
      sessionId?: string;
    } = {}
  ): InferenceJob {
    const job: InferenceJob = {
      id: this.generateJobId(),
      type,
      priority: options.priority || 'NORMAL',
      status: 'PENDING',
      input,
      config: {
        preferLocal: options.preferLocal ?? true,
        maxRetries: options.maxRetries ?? 2,
        timeoutMs: DEFAULT_TIMEOUTS[type],
        targetDevice: options.targetDevice,
      },
      createdAt: Date.now(),
      retryCount: 0,
      userId: options.userId,
      deviceId: options.deviceId,
      sessionId: options.sessionId,
    };
    
    this.queue.set(job.id, job);
    this.emit('job:added', job);
    
    console.log(`[InferenceQueue] Job added: ${job.id} (${type}, ${job.priority})`);
    
    // 触发处理
    this.processNext();
    
    return job;
  }
  
  // 获取任务状态
  getJob(jobId: string): InferenceJob | undefined {
    return this.queue.get(jobId);
  }
  
  // 获取队列状态
  getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    jobs: InferenceJob[];
  } {
    const jobs = Array.from(this.queue.values());
    return {
      pending: jobs.filter(j => j.status === 'PENDING').length,
      running: jobs.filter(j => j.status === 'RUNNING').length,
      completed: jobs.filter(j => j.status === 'COMPLETED').length,
      failed: jobs.filter(j => j.status === 'FAILED').length,
      jobs: jobs.slice(-50), // 最近50个任务
    };
  }
  
  // 取消任务
  cancelJob(jobId: string): boolean {
    const job = this.queue.get(jobId);
    if (!job || job.status === 'COMPLETED' || job.status === 'FAILED') {
      return false;
    }
    
    job.status = 'CANCELLED';
    job.completedAt = Date.now();
    this.processing.delete(jobId);
    this.emit('job:cancelled', job);
    
    console.log(`[InferenceQueue] Job cancelled: ${jobId}`);
    return true;
  }
  
  // 获取下一个待处理任务（按优先级排序）
  private getNextPendingJob(): InferenceJob | undefined {
    const pendingJobs = Array.from(this.queue.values())
      .filter(j => j.status === 'PENDING')
      .sort((a, b) => {
        // 先按优先级
        const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // 再按创建时间
        return a.createdAt - b.createdAt;
      });
    
    return pendingJobs[0];
  }
  
  // 处理下一个任务
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    if (this.processing.size >= this.maxConcurrent) return;
    
    const job = this.getNextPendingJob();
    if (!job) return;
    
    this.isProcessing = true;
    
    try {
      await this.executeJob(job);
    } finally {
      this.isProcessing = false;
      // 继续处理下一个
      setTimeout(() => this.processNext(), 100);
    }
  }
  
  // 执行任务（需要外部注入处理器）
  private jobProcessor?: (job: InferenceJob) => Promise<InferenceJob['result']>;
  
  setJobProcessor(processor: (job: InferenceJob) => Promise<InferenceJob['result']>): void {
    this.jobProcessor = processor;
  }
  
  private async executeJob(job: InferenceJob): Promise<void> {
    if (!this.jobProcessor) {
      console.error('[InferenceQueue] No job processor set');
      job.status = 'FAILED';
      job.error = 'No job processor configured';
      return;
    }
    
    job.status = 'RUNNING';
    job.startedAt = Date.now();
    this.processing.add(job.id);
    this.emit('job:started', job);
    
    console.log(`[InferenceQueue] Job started: ${job.id}`);
    
    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), job.config.timeoutMs);
      });
      
      const result = await Promise.race([
        this.jobProcessor(job),
        timeoutPromise,
      ]);
      
      job.result = result;
      job.status = 'COMPLETED';
      job.completedAt = Date.now();
      
      console.log(`[InferenceQueue] Job completed: ${job.id} in ${job.completedAt - (job.startedAt || job.createdAt)}ms`);
      this.emit('job:completed', job);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage === 'Job timeout') {
        job.status = 'TIMEOUT';
        console.log(`[InferenceQueue] Job timeout: ${job.id}`);
      } else if (job.retryCount < job.config.maxRetries) {
        // 重试
        job.retryCount++;
        job.status = 'PENDING';
        console.log(`[InferenceQueue] Job retry ${job.retryCount}/${job.config.maxRetries}: ${job.id}`);
        this.emit('job:retry', job);
      } else {
        job.status = 'FAILED';
        job.error = errorMessage;
        console.log(`[InferenceQueue] Job failed: ${job.id} - ${errorMessage}`);
        this.emit('job:failed', job);
      }
      
      job.completedAt = Date.now();
    } finally {
      this.processing.delete(job.id);
    }
  }
  
  // 清理已完成的旧任务
  cleanup(maxAge: number = 3600000): number {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;
    
    const entries = Array.from(this.queue.entries());
    for (const [id, job] of entries) {
      if (
        (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') &&
        (job.completedAt || job.createdAt) < cutoff
      ) {
        this.queue.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[InferenceQueue] Cleaned ${cleaned} old jobs`);
    }
    
    return cleaned;
  }
}

// ===== 全局队列实例 =====
export const inferenceQueue = new InferenceQueue(3);

// 定期清理
setInterval(() => inferenceQueue.cleanup(), 600000); // 每10分钟清理一次
