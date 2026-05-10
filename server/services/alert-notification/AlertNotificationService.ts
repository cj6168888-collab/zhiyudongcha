/**
 * 告警通知服务 - AlertNotificationService
 *
 * 提供任务和设备相关的告警通知能力：
 * - 任务执行失败告警
 * - 任务超时告警
 * - 设备离线告警
 * - 设备异常告警
 * - 多种通知渠道 (BUBBLE, PUSH, EMAIL)
 *
 * @version 1.0.0
 * @author 架构组
 */

import { createServiceLogger } from '../../lib/logger';
import { webSocketManager } from '../../websocket';
import { taskAlertRepository } from '../../repositories';
import type { TaskAlert, InsertTaskAlert } from '../../../shared/schema';

const logger = createServiceLogger('AlertService');

// 告警类型
export type AlertType =
  | 'TASK_FAILED'
  | 'TASK_TIMEOUT'
  | 'DEVICE_OFFLINE'
  | 'DEVICE_ONLINE'
  | 'EXECUTION_ERROR'
  | 'SYSTEM_ERROR';

// 告警严重级别
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// 通知渠道
export type NotificationChannel = 'BUBBLE' | 'PUSH' | 'EMAIL';

// 告警配置
export interface AlertConfig {
  channels: NotificationChannel[];
  severity: AlertSeverity;
  autoDismiss?: boolean;
  dismissAfterMs?: number;
}

// 默认告警配置
const DEFAULT_CONFIG: AlertConfig = {
  channels: ['BUBBLE'],
  severity: 'MEDIUM',
  autoDismiss: true,
  dismissAfterMs: 60000, // 1分钟后自动消失
};

// 告警服务配置
export interface AlertServiceConfig {
  taskFailedAlert?: boolean;
  deviceOfflineAlert?: boolean;
  enableEmailNotifications?: boolean;
  emailRecipients?: string[];
  maxConcurrentAlerts?: number;
}

const DEFAULT_SERVICE_CONFIG: AlertServiceConfig = {
  taskFailedAlert: true,
  deviceOfflineAlert: true,
  enableEmailNotifications: false,
  maxConcurrentAlerts: 100,
};

// 告警通知数据结构
export interface AlertNotification {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  taskId?: string;
  executionId?: string;
  deviceId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export class AlertNotificationService {
  private static instance: AlertNotificationService | null = null;

  private config: AlertServiceConfig;
  private activeAlerts: Map<string, TaskAlert> = new Map();
  private listeners: Map<string, ((alert: AlertNotification) => void)[]> = new Map();

  private constructor(config: Partial<AlertServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<AlertServiceConfig>): AlertNotificationService {
    if (!AlertNotificationService.instance) {
      AlertNotificationService.instance = new AlertNotificationService(config);
    }
    return AlertNotificationService.instance;
  }

  // ============================================
  // 告警通知接口
  // ============================================

  /**
   * 告警通知数据结构
   */


  // ============================================
  // 告警创建
  // ============================================

  /**
   * 创建任务失败告警
   */
  public async createTaskFailedAlert(
    taskId: string,
    taskName: string,
    executionId: string,
    error: string,
    severity: AlertSeverity = 'HIGH'
  ): Promise<AlertNotification | null> {
    if (!this.config.taskFailedAlert) {
      return null;
    }

    return this.createAlert({
      type: 'TASK_FAILED',
      severity,
      title: `任务执行失败: ${taskName}`,
      message: error,
      taskId,
      executionId,
      metadata: { taskName, error },
    });
  }

  /**
   * 创建任务超时告警
   */
  public async createTaskTimeoutAlert(
    taskId: string,
    taskName: string,
    executionId: string,
    timeout: number
  ): Promise<AlertNotification | null> {
    return this.createAlert({
      type: 'TASK_TIMEOUT',
      severity: 'HIGH',
      title: `任务超时: ${taskName}`,
      message: `任务执行超过 ${timeout / 1000} 秒`,
      taskId,
      executionId,
      metadata: { taskName, timeout },
    });
  }

  /**
   * 创建设备离线告警
   */
  public async createDeviceOfflineAlert(
    deviceId: string,
    deviceName: string
  ): Promise<AlertNotification | null> {
    if (!this.config.deviceOfflineAlert) {
      return null;
    }

    return this.createAlert({
      type: 'DEVICE_OFFLINE',
      severity: 'MEDIUM',
      title: `设备离线: ${deviceName}`,
      message: `设备 ${deviceName} 已断开连接`,
      deviceId,
      metadata: { deviceName },
    });
  }

  /**
   * 创建设备上线告警
   */
  public async createDeviceOnlineAlert(
    deviceId: string,
    deviceName: string
  ): Promise<AlertNotification | null> {
    return this.createAlert({
      type: 'DEVICE_ONLINE',
      severity: 'LOW',
      title: `设备上线: ${deviceName}`,
      message: `设备 ${deviceName} 已连接`,
      deviceId,
      metadata: { deviceName },
    });
  }

  /**
   * 创建执行错误告警
   */
  public async createExecutionErrorAlert(
    taskId: string,
    taskName: string,
    executionId: string,
    actionId: string,
    error: string
  ): Promise<AlertNotification | null> {
    return this.createAlert({
      type: 'EXECUTION_ERROR',
      severity: 'HIGH',
      title: `动作执行错误: ${taskName}`,
      message: `动作 ${actionId} 执行失败: ${error}`,
      taskId,
      executionId,
      metadata: { taskName, actionId, error },
    });
  }

  /**
   * 创建系统错误告警
   */
  public async createSystemErrorAlert(
    error: string,
    severity: AlertSeverity = 'CRITICAL'
  ): Promise<AlertNotification | null> {
    return this.createAlert({
      type: 'SYSTEM_ERROR',
      severity,
      title: '系统错误',
      message: error,
      metadata: { error },
    });
  }

  // ============================================
  // 告警处理
  // ============================================

  /**
   * 创建告警 (内部方法)
   */
  private async createAlert(
    alertData: Omit<AlertNotification, 'id' | 'timestamp'>
  ): Promise<AlertNotification | null> {
    if (this.activeAlerts.size >= this.config.maxConcurrentAlerts!) {
      logger.warn('Max concurrent alerts reached, dropping alert');
      return null;
    }

    const alert: AlertNotification = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // 保存到数据库
    try {
      const dbAlert: InsertTaskAlert = {
        id: alert.id,
        taskId: alert.taskId,
        executionId: alert.executionId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        status: 'PENDING',
        channels: { channels: ['BUBBLE'] },
        metadata: alert.metadata,
      };
      await taskAlertRepository.create(dbAlert);
    } catch (error) {
      logger.error({ alertId: alert.id, error }, 'Failed to persist alert to database');
    }

    // 添加到活跃告警列表
    this.activeAlerts.set(alert.id, alert as unknown as TaskAlert);

    // 通知监听器
    this.notifyListeners(alert);

    // 通过 WebSocket 推送
    this.pushAlert(alert);

    // 自动消散
    if (DEFAULT_CONFIG.autoDismiss) {
      setTimeout(() => {
        this.dismissAlert(alert.id);
      }, DEFAULT_CONFIG.dismissAfterMs);
    }

    logger.info({
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    }, 'Alert created');

    return alert;
  }

  /**
   * 推送告警到客户端
   */
  private pushAlert(alert: AlertNotification): void {
    try {
      webSocketManager.broadcast('alert', {
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        id: alert.id,
        timestamp: alert.timestamp,
        metadata: alert.metadata,
      });
    } catch (error) {
      logger.error({ alert, error }, 'Failed to push alert via WebSocket');
    }
  }

  /**
   * 消散告警
   */
  public dismissAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      this.activeAlerts.delete(alertId);

      // 更新数据库状态
      taskAlertRepository.markAsDismissed(alertId).catch(error => {
        logger.error({ alertId, error }, 'Failed to update alert status in database');
      });

      logger.info({ alertId }, 'Alert dismissed');
      return true;
    }
    return false;
  }

  /**
   * 标记告警为已读
   */
  public async markAsRead(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      await taskAlertRepository.markAsRead(alertId).catch(error => {
        logger.error({ alertId, error }, 'Failed to update alert status in database');
      });
      return true;
    }
    return false;
  }

  /**
   * 获取所有活跃告警
   */
  public getActiveAlerts(): AlertNotification[] {
    return Array.from(this.activeAlerts.values()).map(a => a as unknown as AlertNotification);
  }

  /**
   * 获取告警统计
   */
  public async getAlertStats(): Promise<Record<AlertSeverity, number>> {
    try {
      const stats = await taskAlertRepository.countByStatus();
      const result: Record<AlertSeverity, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };

      // 从数据库获取所有告警并按严重级别统计
      const pendingAlerts = await taskAlertRepository.findPending(1000);
      for (const alert of pendingAlerts) {
        result[alert.severity as AlertSeverity]++;
      }

      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to get alert stats from database');
      return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    }
  }

  // ============================================
  // 告警监听器
  // ============================================

  /**
   * 添加告警监听器
   */
  public addListener(event: string, callback: (alert: AlertNotification) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除告警监听器
   */
  public removeListener(event: string, callback: (alert: AlertNotification) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(alert: AlertNotification): void {
    // 通知特定类型监听器
    const typeListeners = this.listeners.get(alert.type);
    if (typeListeners) {
      typeListeners.forEach(callback => callback(alert));
    }

    // 通知所有监听器
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(callback => callback(alert));
    }
  }

  // ============================================
  // 便捷方法
  // ============================================

  /**
   * 清除所有告警
   */
  public clearAllAlerts(): void {
    this.activeAlerts.clear();
    logger.info('All alerts cleared');
  }

  /**
   * 获取待处理告警
   */
  public async getPendingAlerts(limit: number = 50): Promise<AlertNotification[]> {
    try {
      const dbAlerts = await taskAlertRepository.findPending(limit);
      return dbAlerts.map(alert => ({
        id: alert.id,
        type: alert.type as AlertType,
        severity: alert.severity as AlertSeverity,
        title: alert.title,
        message: alert.message,
        taskId: alert.taskId || undefined,
        executionId: alert.executionId || undefined,
        timestamp: alert.createdAt.getTime(),
        metadata: alert.metadata as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get pending alerts from database');
      return [];
    }
  }

  /**
   * 获取高严重级别告警
   */
  public async getHighPriorityAlerts(): Promise<AlertNotification[]> {
    try {
      const highAlerts = await taskAlertRepository.findBySeverity('HIGH', 50);
      const criticalAlerts = await taskAlertRepository.findBySeverity('CRITICAL', 50);

      return [...criticalAlerts, ...highAlerts].map(alert => ({
        id: alert.id,
        type: alert.type as AlertType,
        severity: alert.severity as AlertSeverity,
        title: alert.title,
        message: alert.message,
        taskId: alert.taskId || undefined,
        executionId: alert.executionId || undefined,
        timestamp: alert.createdAt.getTime(),
        metadata: alert.metadata as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get high priority alerts from database');
      return [];
    }
  }
}

// 导出单例
export const alertNotificationService = AlertNotificationService.getInstance();
export default alertNotificationService;
