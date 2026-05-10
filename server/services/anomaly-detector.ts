/**
 * Navigator-X 异常检测引擎 (Anomaly Detector)
 *
 * 核心功能：
 * 1. 监控节点数据流
 * 2. 检测异常信号
 * 3. 触发红线预警
 * 4. 自动激活预案
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('AnomalyDetector');

import { EventEmitter } from 'events';
import { commandCenter } from './command-center';
import { contingencyEngine } from './contingency-engine';
import { navigatorCore } from './navigator-core';

// ============ 类型定义 ============

export type AnomalyType =
  | 'SUPPLY_BREAK'      // 供应链断裂
  | 'PERSON_ABSENT'     // 人员缺席
  | 'PROGRESS_DELAY'    // 进度延迟
  | 'QUALITY_DROP'      // 质量下降
  | 'CASHFLOW_WARNING'  // 资金流预警
  | 'MORALE_LOW';       // 士气低落

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AnomalySignal {
  id: string;
  nodeId: string;
  nodeName: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  evidence: string[];
  detectedAt: number;
  metrics?: Record<string, number>;
}

export interface StreamData {
  nodeId: string;
  progress: number;        // 进度百分比
  communicationScore: number;  // 沟通评分 (0-100)
  planStrictness: number;      // 方案严密度 (0-100)
  moraleScore: number;          // 士气评分 (0-100)
  lastUpdateAt: number;
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [AnomalyDetector] ${message}`);
}

// ============ 异常检测引擎类 ============

class AnomalyDetectorService extends EventEmitter {
  private streamData: Map<string, StreamData> = new Map();
  private anomalies: Map<string, AnomalySignal> = new Map();
  private thresholds = {
    progressDelay: 0.2,       // 进度延迟超过20%
    communicationLow: 40,     // 沟通评分低于40
    planStrictnessLow: 50,   // 方案严密度低于50
    moraleLow: 50,           // 士气评分低于50
  };

  constructor() {
    super();
    log('异常检测引擎已初始化');
  }

  /**
   * 监控节点数据流
   */
  async monitorNodeStream(nodeId: string, data: Partial<StreamData>): Promise<void> {
    const existingData = this.streamData.get(nodeId) || {
      nodeId,
      progress: 0,
      communicationScore: 80,
      planStrictness: 80,
      moraleScore: 80,
      lastUpdateAt: Date.now(),
    };

    const updatedData: StreamData = {
      ...existingData,
      ...data,
      lastUpdateAt: Date.now(),
    };

    this.streamData.set(nodeId, updatedData);

    // 检测异常
    const anomaly = this.detectAnomaly(updatedData);
    if (anomaly) {
      await this.handleAnomaly(anomaly);
    }
  }

  /**
   * 检测异常信号
   */
  detectAnomaly(data: StreamData): AnomalySignal | null {
    const node = navigatorCore.getNode(data.nodeId);
    const nodeName = node?.name || '未知节点';
    const anomalies: Partial<AnomalySignal>[] = [];

    // 进度延迟检测
    if (data.progress < 50 && Date.now() - data.lastUpdateAt > 2 * 60 * 60 * 1000) {
      anomalies.push({
        type: 'PROGRESS_DELAY',
        severity: data.progress < 20 ? 'HIGH' : 'MEDIUM',
        title: '进度延迟预警',
        description: `节点 ${nodeName} 进度落后于预期`,
        evidence: [`当前进度: ${data.progress}%`, `距上次更新: ${Math.round((Date.now() - data.lastUpdateAt) / 60000)}分钟`],
      });
    }

    // 沟通评分下降检测
    if (data.communicationScore < this.thresholds.communicationLow) {
      anomalies.push({
        type: 'PERSON_ABSENT',
        severity: 'MEDIUM',
        title: '沟通异常',
        description: `节点 ${nodeName} 沟通频率异常下降`,
        evidence: [`沟通评分: ${data.communicationScore}`],
      });
    }

    // 方案严密度下降检测
    if (data.planStrictness < this.thresholds.planStrictnessLow) {
      anomalies.push({
        type: 'QUALITY_DROP',
        severity: data.planStrictness < 30 ? 'HIGH' : 'MEDIUM',
        title: '方案质量下降',
        description: `节点 ${nodeName} 提交方案严密度不足`,
        evidence: [`严密度评分: ${data.planStrictness}`],
      });
    }

    // 士气评分下降检测
    if (data.moraleScore < this.thresholds.moraleLow) {
      anomalies.push({
        type: 'MORALE_LOW',
        severity: 'LOW',
        title: '士气预警',
        description: `节点 ${nodeName} 团队士气偏低`,
        evidence: [`士气评分: ${data.moraleScore}`],
      });
    }

    // 如果有多个异常，提升严重等级
    if (anomalies.length >= 2) {
      anomalies.forEach(a => {
        if (a.severity === 'MEDIUM') a.severity = 'HIGH';
        if (a.severity === 'LOW') a.severity = 'MEDIUM';
      });
    }

    if (anomalies.length > 0) {
      // 返回最严重的异常
      const sorted = anomalies.sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return order[a.severity!] - order[b.severity!];
      });

      return {
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        nodeId: data.nodeId,
        nodeName,
        type: sorted[0].type!,
        severity: sorted[0].severity!,
        title: sorted[0].title!,
        description: sorted[0].description!,
        evidence: sorted[0].evidence!,
        detectedAt: Date.now(),
        metrics: {
          progress: data.progress,
          communicationScore: data.communicationScore,
          planStrictness: data.planStrictness,
          moraleScore: data.moraleScore,
        },
      };
    }

    return null;
  }

  /**
   * 处理异常
   */
  private async handleAnomaly(anomaly: AnomalySignal): Promise<void> {
    this.anomalies.set(anomaly.id, anomaly);

    log(`🚨 检测到异常: ${anomaly.title} [${anomaly.severity}]`);

    // 1. 发送红线预警
    await this.sendRedAlert(anomaly);

    // 2. 自动激活预案
    if (anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL') {
      const plan = contingencyEngine.matchPlan(anomaly);
      if (plan) {
        await contingencyEngine.activate(plan, anomaly);
      }
    }

    this.emit('anomaly_detected', anomaly);
  }

  /**
   * 发送红线预警
   */
  private async sendRedAlert(anomaly: AnomalySignal): Promise<void> {
    await commandCenter.sendRedAlert({
      nodeId: anomaly.nodeId,
      type: anomaly.type as any,
      severity: anomaly.severity,
      title: anomaly.title,
      description: anomaly.description,
      evidence: anomaly.evidence,
    });
  }

  /**
   * 获取所有异常记录
   */
  getAnomalies(filter?: { nodeId?: string; severity?: AnomalySeverity }): AnomalySignal[] {
    let anomalies = Array.from(this.anomalies.values());

    if (filter?.nodeId) {
      anomalies = anomalies.filter(a => a.nodeId === filter.nodeId);
    }
    if (filter?.severity) {
      anomalies = anomalies.filter(a => a.severity === filter.severity);
    }

    return anomalies.sort((a, b) => b.detectedAt - a.detectedAt);
  }

  /**
   * 获取节点数据流
   */
  getStreamData(nodeId: string): StreamData | undefined {
    return this.streamData.get(nodeId);
  }

  /**
   * 获取所有节点数据流
   */
  getAllStreamData(): StreamData[] {
    return Array.from(this.streamData.values());
  }

  /**
   * 更新检测阈值
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    log(`阈值已更新: ${JSON.stringify(this.thresholds)}`);
  }
}

// 导出单例
export const anomalyDetector = new AnomalyDetectorService();
logger.info('[AnomalyDetector] 异常检测引擎已加载 (Navigator-X)');
