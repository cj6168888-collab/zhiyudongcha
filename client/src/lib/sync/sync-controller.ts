import type { SyncItem, SyncConflict } from '../chat/types';
import { createServiceLogger } from '../logger';

const logger = createServiceLogger('SyncController');

const PENDING_KEY = 'sync_pending';
const CONFLICTED_KEY = 'sync_conflicted';
const FAILED_KEY = 'sync_failed';

export class SyncController {
  private pendingItems: Map<string, SyncItem> = new Map();
  private conflictedItems: Map<string, SyncItem> = new Map();
  private failedItems: Map<string, SyncItem & { failedAt: number }> = new Map();
  private syncInProgress = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const pendingData = localStorage.getItem(PENDING_KEY);
      if (pendingData) {
        const items: SyncItem[] = JSON.parse(pendingData);
        for (const item of items) {
          this.pendingItems.set(item.id, item);
        }
      }

      const conflictedData = localStorage.getItem(CONFLICTED_KEY);
      if (conflictedData) {
        const items: SyncItem[] = JSON.parse(conflictedData);
        for (const item of items) {
          this.conflictedItems.set(item.id, item);
        }
      }

      const failedData = localStorage.getItem(FAILED_KEY);
      if (failedData) {
        const items = JSON.parse(failedData);
        for (const item of items) {
          this.failedItems.set(item.id, item);
        }
      }
    } catch (error) {
      logger.warn('从存储加载失败', { error: String(error) });
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify(Array.from(this.pendingItems.values()))
      );
      localStorage.setItem(
        CONFLICTED_KEY,
        JSON.stringify(Array.from(this.conflictedItems.values()))
      );
      localStorage.setItem(
        FAILED_KEY,
        JSON.stringify(Array.from(this.failedItems.values()).slice(-100))
      );
    } catch (error) {
      logger.warn('存储失败', { error: String(error) });
    }
  }

  async queueForSync<T>(data: T, type: SyncItem['type'] = 'MESSAGE'): Promise<string> {
    const id = this.generateId();

    const item: SyncItem = {
      id,
      type,
      localData: data,
      timestamp: Date.now(),
      conflictResolution: 'MERGE',
      status: 'PENDING',
      retryCount: 0,
    };

    this.pendingItems.set(id, item);
    this.saveToStorage();
    this.processQueue();

    return id;
  }

  async processQueue(): Promise<void> {
    if (this.syncInProgress) return;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      logger.info('离线状态，等待网络恢复');
      return;
    }

    this.syncInProgress = true;

    try {
      const items = Array.from(this.pendingItems.values()).filter(
        item => item.status === 'PENDING'
      );

      for (const item of items) {
        if (item.status !== 'PENDING') continue;

        try {
          await this.syncItem(item);
          item.status = 'SYNCED';
          this.pendingItems.delete(item.id);
        } catch (error) {
          await this.handleSyncError(item, error);
        }

        await this.delay(200);
      }
    } finally {
      this.syncInProgress = false;
      this.saveToStorage();
    }
  }

  private async syncItem(item: SyncItem): Promise<void> {
    const endpoint = this.getEndpoint(item.type);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item.localData,
        _syncId: item.id,
        _timestamp: item.timestamp,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        const serverData = await response.json();
        await this.resolveConflict(item, serverData);
      } else if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      } else if (response.status === 503) {
        throw new Error('SERVER_UNAVAILABLE');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } else {
      item.serverData = await response.json();
    }
  }

  private async resolveConflict(
    item: SyncItem,
    serverData: unknown
  ): Promise<void> {
    const conflict: SyncConflict = {
      localData: item.localData,
      serverData,
      localTimestamp: item.timestamp,
      serverTimestamp: Date.now(),
    };

    switch (item.conflictResolution) {
      case 'LOCAL_WINS':
        await this.forceUpload(item);
        break;

      case 'SERVER_WINS':
        item.localData = serverData;
        item.status = 'SYNCED';
        this.pendingItems.delete(item.id);
        break;

      case 'MERGE':
        item.localData = this.mergeData(item.localData, serverData);
        await this.forceUpload(item);
        break;

      case 'ASK_USER':
        item.serverData = serverData;
        item.status = 'CONFLICT';
        this.pendingItems.delete(item.id);
        this.conflictedItems.set(item.id, item);
        break;
    }
  }

  private async forceUpload(item: SyncItem): Promise<void> {
    const endpoint = `${this.getEndpoint(item.type)}?force=true`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item.localData,
        _syncId: item.id,
        _timestamp: item.timestamp,
        _force: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Force upload failed: ${response.status}`);
    }

    item.status = 'SYNCED';
  }

  private mergeData(local: unknown, server: unknown): unknown {
    if (typeof local !== typeof server) return local;
    if (typeof local !== 'object' || local === null || server === null) {
      const localTs = (local as { timestamp?: number })?.timestamp ?? 0;
      const serverTs = (server as { timestamp?: number })?.timestamp ?? 0;
      return localTs > serverTs ? local : server;
    }

    const localObj = local as Record<string, unknown>;
    const serverObj = server as Record<string, unknown>;
    const result: Record<string, unknown> = { ...serverObj };

    for (const key of Object.keys(localObj)) {
      if (key in serverObj) {
        result[key] = this.mergeData(localObj[key], serverObj[key]);
      } else {
        result[key] = localObj[key];
      }
    }

    return result;
  }

  private async handleSyncError(
    item: SyncItem,
    error: unknown
  ): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);

    item.retryCount++;
    item.lastError = errorMsg;

    if (item.retryCount >= 3) {
      item.status = 'FAILED';
      this.pendingItems.delete(item.id);
      this.failedItems.set(item.id, {
        ...item,
        failedAt: Date.now(),
      });
      logger.error('同步失败', { itemId: item.id, error: String(error) });
    } else {
      const delay = Math.min(1000 * Math.pow(2, item.retryCount), 60000);
      await this.delay(delay);
    }
  }

  resolveConflictSync(
    itemId: string,
    resolution: 'LOCAL' | 'SERVER' | 'MERGE'
  ): void {
    const item = this.conflictedItems.get(itemId);
    if (!item) {
    logger.warn('未找到冲突项', { itemId });
      return;
    }

    switch (resolution) {
      case 'LOCAL':
        this.pendingItems.set(item.id, { ...item, status: 'PENDING' });
        break;
      case 'SERVER':
        item.localData = item.serverData;
        item.status = 'SYNCED';
        break;
      case 'MERGE':
        item.localData = this.mergeData(item.localData, item.serverData);
        this.pendingItems.set(item.id, { ...item, status: 'PENDING' });
        break;
    }

    this.conflictedItems.delete(itemId);
    this.saveToStorage();
    this.processQueue();
  }

  private getEndpoint(type: SyncItem['type']): string {
    const endpoints: Record<string, string> = {
      MESSAGE: '/api/sync/messages',
      CONFIG: '/api/sync/config',
      STATE: '/api/sync/state',
      ARTIFACT: '/api/sync/artifacts',
    };
    return endpoints[type] ?? '/api/sync';
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getPendingCount(): number {
    return this.pendingItems.size;
  }

  getConflictedCount(): number {
    return this.conflictedItems.size;
  }

  getFailedCount(): number {
    return this.failedItems.size;
  }

  getStatus(): {
    pending: number;
    conflicted: number;
    failed: number;
    isOnline: boolean;
    syncing: boolean;
  } {
    return {
      pending: this.pendingItems.size,
      conflicted: this.conflictedItems.size,
      failed: this.failedItems.size,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
      syncing: this.syncInProgress,
    };
  }

  async forceSync(): Promise<void> {
    if (typeof window !== 'undefined' && navigator.onLine) {
      await this.processQueue();
    }
  }

  clearFailed(): void {
    this.failedItems.clear();
    this.saveToStorage();
  }

  clearAll(): void {
    this.pendingItems.clear();
    this.conflictedItems.clear();
    this.failedItems.clear();
    this.saveToStorage();
  }
}

export const syncController = new SyncController();
