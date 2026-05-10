import { DEFAULT_FALLBACK_CONFIG, type FallbackConfig, type QueuedMessage } from './types';

const QUEUE_STORAGE_KEY = 'xiaozhi_message_queue';
const FAILED_STORAGE_KEY = 'xiaozhi_failed_messages';
const PENDING_SYNC_KEY = 'xiaozhi_pending_sync';

const PRIORITY_ORDER = { HIGH: 0, NORMAL: 1, LOW: 2 } as const;

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private pendingSync: Map<string, unknown> = new Map();
  private isProcessing = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadFromStorage();
    this.startAutoSync();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.processQueue();
    });

    window.addEventListener('offline', () => {
    });
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const queueData = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
      }

      const pendingData = localStorage.getItem(PENDING_SYNC_KEY);
      if (pendingData) {
        const pending = JSON.parse(pendingData);
        for (const [id, data] of Object.entries(pending)) {
          this.pendingSync.set(id, data);
        }
      }
    } catch (error) {
      console.warn('[MessageQueue] 从存储加载失败:', error);
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));

      const pendingObj: Record<string, unknown> = {};
      for (const [id, data] of this.pendingSync) {
        pendingObj[id] = data;
      }
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingObj));
    } catch (error) {
      console.warn('[MessageQueue] 存储失败:', error);
    }
  }

  enqueue(
    message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>
  ): string {
    const id = this.generateId();

    const queued: QueuedMessage = {
      ...message,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const insertIdx = this.queue.findIndex(
      m => PRIORITY_ORDER[m.priority] > PRIORITY_ORDER[message.priority]
    );

    if (insertIdx === -1) {
      this.queue.push(queued);
    } else {
      this.queue.splice(insertIdx, 0, queued);
    }

    this.saveToStorage();
    this.processQueue();

    return id;
  }

  dequeue(): QueuedMessage | null {
    if (this.queue.length === 0) return null;
    return this.queue.shift()!;
  }

  peek(): QueuedMessage | null {
    return this.queue[0] ?? null;
  }

  remove(id: string): boolean {
    const idx = this.queue.findIndex(m => m.id === id);
    if (idx === -1) return false;

    this.queue.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  getSize(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const message = this.peek();
        if (!message) break;

        try {
          await this.processMessage(message);
          this.dequeue();
        } catch (error) {
          await this.handleError(message, error);
        }

        await this.delay(100);
      }
    } finally {
      this.isProcessing = false;
      this.saveToStorage();
    }
  }

  private async processMessage(message: QueuedMessage): Promise<void> {
    const endpoint = this.getEndpoint(message.type);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...message.payload,
        _queueId: message.id,
        _timestamp: message.timestamp,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('CONFLICT');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const syncId = message.type === 'SYNC' ? message.id : undefined;
    if (syncId) {
      this.pendingSync.delete(syncId);
    }
  }

  private async handleError(
    message: QueuedMessage,
    error: unknown
  ): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg === 'CONFLICT') {
      console.warn(`[MessageQueue] 冲突，跳过: ${message.id}`);
      this.dequeue();
      return;
    }

    message.retryCount++;

    if (message.retryCount >= message.maxRetries) {
      console.error(`[MessageQueue] 达到最大重试次数: ${message.id}`);
      this.dequeue();
      this.storeFailed(message, error);
    } else {
      const delay = Math.min(1000 * Math.pow(2, message.retryCount), 30000);
      console.warn(
        `[MessageQueue] 重试 ${message.retryCount}/${message.maxRetries}: ${message.id}`
      );
      await this.delay(delay);
    }
  }

  private storeFailed(message: QueuedMessage, error: unknown): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(FAILED_STORAGE_KEY);
      const failed: QueuedMessage[] = stored ? JSON.parse(stored) : [];

      failed.push({
        ...message,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      } as QueuedMessage & { error: string; failedAt: number });

      const trimmed = failed.slice(-100);
      localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[MessageQueue] 存储失败消息失败:', e);
    }
  }

  getFailedMessages(): (QueuedMessage & { error: string; failedAt: number })[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(FAILED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  clearFailedMessages(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FAILED_STORAGE_KEY);
    }
  }

  getPendingSyncCount(): number {
    return this.pendingSync.size;
  }

  private getEndpoint(type: QueuedMessage['type']): string {
    const endpoints: Record<string, string> = {
      CHAT: '/api/chat',
      SYNC: '/api/sync/messages',
      CONFIG: '/api/user/config',
      FEEDBACK: '/api/feedback',
      ARTIFACT: '/api/sync/artifacts',
    };
    return endpoints[type] ?? '/api/sync';
  }

  private generateId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startAutoSync(): void {
    if (typeof window === 'undefined') return;

    this.syncTimer = setInterval(() => {
      if (navigator.onLine) {
        this.processQueue();
      }
    }, 30000);
  }

  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }

  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }
}

export const messageQueue = new MessageQueue();
