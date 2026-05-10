/**
 * 小智离线同步服务 (Offline Sync Service)
 * Phase 4.4 - 移动端离线加固
 * 
 * 功能：
 * 1. 离线数据同步策略
 * 2. 增量同步管理
 * 3. 冲突解决
 * 4. 网络状态感知
 * 5. 后台任务调度
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('OfflineSync');

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export type SyncStatus = 'IDLE' | 'SYNCING' | 'CONFLICT' | 'FAILED' | 'OFFLINE';
export type ConflictResolution = 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL';
export type SyncPriority = 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

export interface SyncableEntity {
  entityType: string;
  entityId: string;
  version: number;
  lastModified: number;
  data: Record<string, unknown>;
  checksum: string;
}

export interface SyncOperation {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CONFLICT';
  priority: SyncPriority;
  deviceId: string;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  serverVersion: SyncableEntity;
  clientVersion: SyncableEntity;
  detectedAt: number;
  resolution?: ConflictResolution;
  resolvedAt?: number;
  resolvedData?: Record<string, unknown>;
}

export interface DeviceSyncState {
  deviceId: string;
  lastSyncTime: number;
  lastSyncVersion: number;
  pendingOperations: number;
  conflicts: number;
  status: SyncStatus;
  networkType: 'WIFI' | 'CELLULAR' | 'OFFLINE' | 'UNKNOWN';
}

export interface SyncManifest {
  version: number;
  entities: {
    type: string;
    count: number;
    lastModified: number;
    checksum: string;
  }[];
  generatedAt: number;
}

export interface BackgroundTask {
  id: string;
  name: string;
  type: 'SYNC' | 'CLEANUP' | 'PREFETCH' | 'COMPRESS';
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  scheduledAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
}

const SYNC_ENTITY_TYPES = [
  'persons',
  'vault_items',
  'projects',
  'calendar_events',
  'reminders',
  'shadow_memories',
  'conversation_insights',
];

class OfflineSyncService {
  private deviceStates: Map<string, DeviceSyncState> = new Map();
  private pendingOperations: Map<string, SyncOperation[]> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();
  private serverVersion: number = 1;
  private backgroundTasks: Map<string, BackgroundTask> = new Map();

  constructor() {
    logger.info('[OfflineSync] 离线同步服务已启动');
    logger.info(`[OfflineSync] 支持同步实体: ${SYNC_ENTITY_TYPES.join(', ')}`);
  }

  registerDevice(deviceId: string): DeviceSyncState {
    const state: DeviceSyncState = {
      deviceId,
      lastSyncTime: 0,
      lastSyncVersion: 0,
      pendingOperations: 0,
      conflicts: 0,
      status: 'IDLE',
      networkType: 'UNKNOWN',
    };

    this.deviceStates.set(deviceId, state);
    this.pendingOperations.set(deviceId, []);

    logger.info(`[OfflineSync] 设备已注册: ${deviceId}`);
    return state;
  }

  updateNetworkStatus(deviceId: string, networkType: DeviceSyncState['networkType']): void {
    const state = this.deviceStates.get(deviceId);
    if (state) {
      const wasOffline = state.networkType === 'OFFLINE';
      state.networkType = networkType;
      
      if (wasOffline && networkType !== 'OFFLINE') {
        logger.info(`[OfflineSync] 设备 ${deviceId} 恢复在线，启动同步`);
        this.triggerSync(deviceId);
      }
      
      if (networkType === 'OFFLINE') {
        state.status = 'OFFLINE';
      }
    }
  }

  queueOperation(deviceId: string, operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
    const opId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const syncOp: SyncOperation = {
      ...operation,
      id: opId,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'PENDING',
      deviceId,
    };

    const ops = this.pendingOperations.get(deviceId) || [];
    ops.push(syncOp);
    ops.sort((a, b) => {
      const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2, BACKGROUND: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    this.pendingOperations.set(deviceId, ops);

    const state = this.deviceStates.get(deviceId);
    if (state) {
      state.pendingOperations = ops.length;
    }

    logger.info(`[OfflineSync] 操作已入队: ${operation.operation} ${operation.entityType}/${operation.entityId}`);
    return opId;
  }

  async triggerSync(deviceId: string): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    conflicts: number;
  }> {
    const state = this.deviceStates.get(deviceId);
    if (!state) {
      return { success: false, synced: 0, failed: 0, conflicts: 0 };
    }

    if (state.networkType === 'OFFLINE') {
      logger.info(`[OfflineSync] 设备 ${deviceId} 离线，跳过同步`);
      return { success: false, synced: 0, failed: 0, conflicts: 0 };
    }

    state.status = 'SYNCING';
    const ops = this.pendingOperations.get(deviceId) || [];
    
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    for (const op of ops) {
      try {
        op.status = 'IN_PROGRESS';
        
        const conflict = await this.checkForConflict(op);
        if (conflict) {
          op.status = 'CONFLICT';
          this.conflicts.set(conflict.id, conflict);
          conflicts++;
          continue;
        }

        await this.applyOperation(op);
        op.status = 'COMPLETED';
        synced++;

      } catch (error) {
        op.retryCount++;
        if (op.retryCount >= 3) {
          op.status = 'FAILED';
          failed++;
        } else {
          op.status = 'PENDING';
        }
      }
    }

    const remainingOps = ops.filter(op => op.status === 'PENDING' || op.status === 'CONFLICT');
    this.pendingOperations.set(deviceId, remainingOps);

    state.lastSyncTime = Date.now();
    state.lastSyncVersion = this.serverVersion;
    state.pendingOperations = remainingOps.length;
    state.conflicts = conflicts;
    state.status = conflicts > 0 ? 'CONFLICT' : 'IDLE';

    logger.info(`[OfflineSync] 同步完成: 成功=${synced}, 失败=${failed}, 冲突=${conflicts}`);

    return { success: true, synced, failed, conflicts };
  }

  private async checkForConflict(op: SyncOperation): Promise<SyncConflict | null> {
    const serverEntity = this.getServerEntity(op.entityType, op.entityId);
    
    if (!serverEntity) {
      return null;
    }

    if (op.operation === 'UPDATE' && op.data?.version !== undefined) {
      if (serverEntity.version > op.data.version) {
        const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const conflict: SyncConflict = {
          id: conflictId,
          entityType: op.entityType,
          entityId: op.entityId,
          serverVersion: serverEntity,
          clientVersion: {
            entityType: op.entityType,
            entityId: op.entityId,
            version: op.data.version,
            lastModified: op.timestamp,
            data: op.data,
            checksum: this.generateDataChecksum(op.data),
          },
          detectedAt: Date.now(),
        };

        logger.info(`[OfflineSync] 检测到冲突: ${op.entityType}/${op.entityId} (服务端v${serverEntity.version} vs 客户端v${op.data.version})`);
        return conflict;
      }
    }

    return null;
  }

  private getServerEntity(entityType: string, entityId: string): SyncableEntity | null {
    return null;
  }

  private generateDataChecksum(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async applyOperation(op: SyncOperation): Promise<void> {
    logger.info(`[OfflineSync] 应用操作: ${op.operation} ${op.entityType}/${op.entityId}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  resolveConflict(
    conflictId: string, 
    resolution: ConflictResolution, 
    resolvedData?: Record<string, unknown>
  ): boolean {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return false;

    conflict.resolution = resolution;
    conflict.resolvedAt = Date.now();

    switch (resolution) {
      case 'SERVER_WINS':
        conflict.resolvedData = conflict.serverVersion.data;
        break;
      case 'CLIENT_WINS':
        conflict.resolvedData = conflict.clientVersion.data;
        break;
      case 'MERGE':
        conflict.resolvedData = this.mergeData(
          conflict.serverVersion.data,
          conflict.clientVersion.data
        );
        break;
      case 'MANUAL':
        conflict.resolvedData = resolvedData;
        break;
    }

    logger.info(`[OfflineSync] 冲突已解决: ${conflictId} (${resolution})`);
    this.conflicts.delete(conflictId);

    return true;
  }

  private mergeData(serverData: Record<string, unknown>, clientData: Record<string, unknown>): Record<string, unknown> {
    if (typeof serverData !== 'object' || typeof clientData !== 'object') {
      return clientData;
    }

    const merged = { ...serverData };
    for (const key of Object.keys(clientData)) {
      if (clientData[key] !== undefined) {
        merged[key] = clientData[key];
      }
    }
    return merged;
  }

  generateSyncManifest(): SyncManifest {
    return {
      version: this.serverVersion,
      entities: SYNC_ENTITY_TYPES.map(type => ({
        type,
        count: 0,
        lastModified: Date.now(),
        checksum: this.generateChecksum(type),
      })),
      generatedAt: Date.now(),
    };
  }

  private generateChecksum(entityType: string): string {
    return `${entityType}_${this.serverVersion}_${Date.now().toString(36)}`;
  }

  getIncrementalChanges(deviceId: string, sinceVersion: number): {
    changes: SyncableEntity[];
    currentVersion: number;
  } {
    logger.info(`[OfflineSync] 获取增量变更: 设备=${deviceId}, 从版本=${sinceVersion}`);
    
    return {
      changes: [],
      currentVersion: this.serverVersion,
    };
  }

  scheduleBackgroundTask(task: Omit<BackgroundTask, 'id' | 'status' | 'scheduledAt'>): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const bgTask: BackgroundTask = {
      ...task,
      id: taskId,
      status: 'SCHEDULED',
      scheduledAt: Date.now(),
    };

    this.backgroundTasks.set(taskId, bgTask);
    logger.info(`[OfflineSync] 后台任务已调度: ${task.name} (${task.type})`);

    setTimeout(() => this.executeBackgroundTask(taskId), 0);

    return taskId;
  }

  private async executeBackgroundTask(taskId: string): Promise<void> {
    const task = this.backgroundTasks.get(taskId);
    if (!task) return;

    task.status = 'RUNNING';
    task.startedAt = Date.now();

    try {
      switch (task.type) {
        case 'SYNC':
          break;
        case 'CLEANUP':
          task.result = { cleanedItems: 0 };
          break;
        case 'PREFETCH':
          task.result = { prefetchedItems: 0 };
          break;
        case 'COMPRESS':
          task.result = { compressedSize: 0, originalSize: 0 };
          break;
      }

      task.status = 'COMPLETED';
      task.completedAt = Date.now();
      logger.info(`[OfflineSync] 后台任务完成: ${task.name}`);

    } catch (error: unknown) {
      task.status = 'FAILED';
      task.error = getErrorMessage(error);
      task.completedAt = Date.now();
      logger.error({ error, taskName: task.name }, '后台任务失败');
    }
  }

  getDeviceState(deviceId: string): DeviceSyncState | undefined {
    return this.deviceStates.get(deviceId);
  }

  getAllDeviceStates(): DeviceSyncState[] {
    return Array.from(this.deviceStates.values());
  }

  getPendingOperations(deviceId: string): SyncOperation[] {
    return this.pendingOperations.get(deviceId) || [];
  }

  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values());
  }

  getBackgroundTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values())
      .sort((a, b) => b.scheduledAt - a.scheduledAt);
  }

  getSyncStats(): {
    totalDevices: number;
    onlineDevices: number;
    pendingOperations: number;
    unresolvedConflicts: number;
    lastSyncTime: number;
  } {
    const devices = Array.from(this.deviceStates.values());
    const allOps = Array.from(this.pendingOperations.values()).flat();

    return {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.networkType !== 'OFFLINE').length,
      pendingOperations: allOps.filter(op => op.status === 'PENDING').length,
      unresolvedConflicts: this.conflicts.size,
      lastSyncTime: Math.max(...devices.map(d => d.lastSyncTime), 0),
    };
  }
}

export const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
