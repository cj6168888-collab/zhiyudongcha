/**
 * 告警服务
 * Phase 7 - 监控告警
 */

import { createServiceLogger } from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createServiceLogger('AlertService');

export interface Alert {
  name: string;
  condition: string;
  duration: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  actions: string[];
}

export interface AlertConfig {
  alerts: Alert[];
  notification: {
    channels: string[];
    webhook?: {
      url: string;
      method: string;
    };
  };
}

interface AlertState {
  name: string;
  triggered: boolean;
  startTime?: number;
  message?: string;
}

class AlertService {
  private config: AlertConfig | null = null;
  private alertStates: Map<string, AlertState> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  async initialize(configPath?: string): Promise<void> {
    const defaultPath = path.join(process.cwd(), 'config', 'alerts.json');
    const filePath = configPath || defaultPath;

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.config = JSON.parse(content);
        logger.info({ alertCount: this.config.alerts.length }, 'Alert service initialized');
        
        for (const alert of this.config.alerts) {
          this.alertStates.set(alert.name, { name: alert.name, triggered: false });
        }
      } else {
        logger.warn('Alert config not found, using defaults');
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      logger.error({ error }, 'Failed to load alert config');
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): AlertConfig {
    return {
      alerts: [
        {
          name: 'high_cpu_usage',
          condition: 'cpu > 90',
          duration: '5m',
          severity: 'critical',
          message: 'CPU 使用率超过 90%',
          actions: ['notify'],
        },
        {
          name: 'high_memory_usage',
          condition: 'memory > 85',
          duration: '5m',
          severity: 'warning',
          message: '内存使用率超过 85%',
          actions: ['notify'],
        },
      ],
      notification: {
        channels: ['log'],
      },
    };
  }

  start(metricsGetter: () => Promise<Record<string, number>>, intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        const metrics = await metricsGetter();
        this.checkAlerts(metrics);
      } catch (error) {
        logger.error({ error }, 'Error checking alerts');
      }
    }, intervalMs);

    logger.info({ intervalMs }, 'Alert checking started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Alert checking stopped');
    }
  }

  private checkAlerts(metrics: Record<string, number>): void {
    if (!this.config) return;

    for (const alert of this.config.alerts) {
      const triggered = this.evaluateCondition(alert.condition, metrics);
      const state = this.alertStates.get(alert.name);

      if (triggered && !state?.triggered) {
        this.triggerAlert(alert, metrics);
      } else if (!triggered && state?.triggered) {
        this.resolveAlert(alert);
      }
    }
  }

  private evaluateCondition(condition: string, metrics: Record<string, number>): boolean {
    const parts = condition.split(/(>|<|>=|<=|==|!=)/);
    if (parts.length !== 3) return false;

    const [, left, op, right] = parts;
    const metricValue = metrics[left.trim()] ?? 0;
    const thresholdValue = parseFloat(right.trim());

    switch (op.trim()) {
      case '>': return metricValue > thresholdValue;
      case '<': return metricValue < thresholdValue;
      case '>=': return metricValue >= thresholdValue;
      case '<=': return metricValue <= thresholdValue;
      case '==': return metricValue === thresholdValue;
      case '!=': return metricValue !== thresholdValue;
      default: return false;
    }
  }

  private async triggerAlert(alert: Alert, metrics: Record<string, number>): Promise<void> {
    const state = this.alertStates.get(alert.name);
    if (state) {
      state.triggered = true;
      state.startTime = Date.now();
      state.message = alert.message;
    }

    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    logger[logLevel]({
      alert: alert.name,
      severity: alert.severity,
      message: alert.message,
      metrics,
      actions: alert.actions,
    }, `🚨 Alert triggered: ${alert.name}`);

    if (this.config?.notification.webhook && alert.actions.includes('notify')) {
      await this.sendWebhook(alert);
    }
  }

  private async resolveAlert(alert: Alert): Promise<void> {
    const state = this.alertStates.get(alert.name);
    if (state) {
      state.triggered = false;
      state.startTime = undefined;
    }

    logger.info({ alert: alert.name }, `✅ Alert resolved: ${alert.name}`);
  }

  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.config?.notification.webhook) return;

    try {
      const response = await fetch(this.config.notification.webhook.url, {
        method: this.config.notification.webhook.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: alert.name,
          severity: alert.severity,
          message: alert.message,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'Webhook notification failed');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send webhook');
    }
  }

  getActiveAlerts(): AlertState[] {
    return Array.from(this.alertStates.values()).filter(s => s.triggered);
  }

  getAllAlerts(): Alert[] {
    return this.config?.alerts || [];
  }
}

export const alertService = new AlertService();
