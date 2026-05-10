/**
 * 小智 Device Sentry - 设备哨兵服务 (常驻感知层)
 * 
 * 功能：
 * 1. 常驻感知 - 不等待启动，主动监控
 * 2. 音频流捕获 - 本地Whisper处理
 * 3. 视觉流捕获 - 场景变化检测
 * 4. 主动提示 - 无感介入，及时通知
 * 5. 多设备协同 - 手机/电脑/眼镜统一管理
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DeviceSentry');

import { getDatabase } from '../db';
import { devices, auditLogs } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

export type SentryMode = 'IDLE' | 'LISTENING' | 'WATCHING' | 'FULL_SENSE' | 'STEALTH';

export interface AudioFrame {
  timestamp: number;
  duration: number;
  sampleRate: number;
  data: Float32Array | number[];
  vadScore: number;
  transcription?: string;
}

export interface VisualFrame {
  timestamp: number;
  width: number;
  height: number;
  changeScore: number;
  detectedObjects?: DetectedObject[];
  ocrText?: string;
  sceneType?: string;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  attributes?: Record<string, any>;
}

export interface ProactiveAlert {
  id: string;
  type: 'insight' | 'warning' | 'opportunity' | 'reminder' | 'action_needed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  context?: Record<string, any>;
  suggestedAction?: string;
  hapticPattern?: 'short' | 'long' | 'double' | 'pattern';
  createdAt: Date;
  expiresAt?: Date;
  acknowledged: boolean;
}

export interface DeviceSentryConfig {
  audioBufferMs: number;
  visualFrameIntervalMs: number;
  vadThreshold: number;
  changeDetectionThreshold: number;
  maxAlertQueue: number;
  stealthMode: boolean;
}

const DEFAULT_CONFIG: DeviceSentryConfig = {
  audioBufferMs: 5000,
  visualFrameIntervalMs: 1000,
  vadThreshold: 0.3,
  changeDetectionThreshold: 0.15,
  maxAlertQueue: 50,
  stealthMode: false,
};

export type SentryAnalysisEvent = 
  | { type: 'audio'; frame: AudioFrame; deviceId: string }
  | { type: 'visual'; frame: VisualFrame; deviceId: string }
  | { type: 'alert'; alert: ProactiveAlert };

export interface DeviceConnection {
  deviceId: string;
  deviceType: 'phone' | 'desktop' | 'glasses' | 'tablet' | 'watch';
  capabilities: {
    hasCamera: boolean;
    hasMicrophone: boolean;
    hasDisplay: boolean;
    hasHaptic: boolean;
    hasLocalAI: boolean;
  };
  status: 'connected' | 'disconnected' | 'syncing';
  lastHeartbeat: Date;
  batteryLevel?: number;
  isCharging?: boolean;
}

class DeviceSentryService {
  private config: DeviceSentryConfig;
  private mode: SentryMode = 'IDLE';
  private connectedDevices: Map<string, DeviceConnection> = new Map();
  private audioBuffer: AudioFrame[] = [];
  private visualBuffer: VisualFrame[] = [];
  private alertQueue: ProactiveAlert[] = [];
  private sentryActive: boolean = false;
  private analysisCallbacks: ((data: SentryAnalysisEvent) => void)[] = [];
  
  constructor(config?: Partial<DeviceSentryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  async startSentry(mode: SentryMode = 'FULL_SENSE'): Promise<void> {
    if (this.sentryActive) {
      logger.info('[DeviceSentry] Already active, changing mode...');
    }
    
    this.mode = mode;
    this.sentryActive = true;
    
    logger.info(`[DeviceSentry] Started in ${mode} mode`);
    
    await getDatabase().insert(auditLogs).values({
      action: 'sentry_start',
      actor: 'system',
      details: { mode },
      result: 'SUCCESS',
    });
  }
  
  async stopSentry(): Promise<void> {
    this.sentryActive = false;
    this.mode = 'IDLE';
    
    logger.info('[DeviceSentry] Stopped');
    
    await getDatabase().insert(auditLogs).values({
      action: 'sentry_stop',
      actor: 'system',
      result: 'SUCCESS',
    });
  }
  
  getStatus(): {
    mode: SentryMode;
    active: boolean;
    devices: number;
    audioBufferSize: number;
    visualBufferSize: number;
    pendingAlerts: number;
  } {
    return {
      mode: this.mode,
      active: this.sentryActive,
      devices: this.connectedDevices.size,
      audioBufferSize: this.audioBuffer.length,
      visualBufferSize: this.visualBuffer.length,
      pendingAlerts: this.alertQueue.filter(a => !a.acknowledged).length,
    };
  }
  
  registerDevice(device: DeviceConnection): void {
    device.lastHeartbeat = new Date();
    device.status = 'connected';
    this.connectedDevices.set(device.deviceId, device);
    
    logger.info(`[DeviceSentry] Device registered: ${device.deviceId} (${device.deviceType})`);
  }
  
  unregisterDevice(deviceId: string): void {
    this.connectedDevices.delete(deviceId);
    logger.info(`[DeviceSentry] Device unregistered: ${deviceId}`);
  }
  
  deviceHeartbeat(deviceId: string, status?: Partial<DeviceConnection>): boolean {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return false;
    
    device.lastHeartbeat = new Date();
    if (status) {
      Object.assign(device, status);
    }
    
    return true;
  }
  
  async processAudioFrame(frame: AudioFrame, deviceId: string): Promise<void> {
    if (!this.sentryActive || (this.mode !== 'LISTENING' && this.mode !== 'FULL_SENSE')) {
      return;
    }
    
    this.audioBuffer.push(frame);
    
    if (this.audioBuffer.length > 100) {
      this.audioBuffer = this.audioBuffer.slice(-50);
    }
    
    if (frame.vadScore >= this.config.vadThreshold) {
      await this.analyzeAudioSegment(frame, deviceId);
    }
  }
  
  private async analyzeAudioSegment(frame: AudioFrame, deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    
    if (device?.capabilities.hasLocalAI && frame.transcription) {
      await this.processTranscription(frame.transcription, deviceId);
    }
    
    this.notifyAnalysisCallbacks({
      type: 'audio',
      frame,
      deviceId,
    });
  }
  
  private async processTranscription(text: string, deviceId: string): Promise<void> {
    const urgentPatterns = [
      { pattern: /价格|报价|多少钱/i, type: 'negotiation' as const },
      { pattern: /合同|签字|签约/i, type: 'contract' as const },
      { pattern: /截止|deadline|紧急/i, type: 'urgent' as const },
      { pattern: /竞争对手|对手/i, type: 'competitive' as const },
      { pattern: /机会|商机|合作/i, type: 'opportunity' as const },
    ];
    
    for (const { pattern, type } of urgentPatterns) {
      if (pattern.test(text)) {
        await this.createProactiveAlert({
          type: type === 'opportunity' ? 'opportunity' : 'insight',
          priority: type === 'urgent' ? 'high' : 'medium',
          title: this.getAlertTitle(type),
          message: this.getAlertMessage(type, text),
          context: { transcription: text, deviceId, triggerType: type },
          hapticPattern: type === 'urgent' ? 'double' : 'short',
        });
        break;
      }
    }
  }
  
  private getAlertTitle(type: string): string {
    const titles: Record<string, string> = {
      negotiation: '谈判信号',
      contract: '合同相关',
      urgent: '紧急事项',
      competitive: '竞争情报',
      opportunity: '商机发现',
    };
    return titles[type] || '洞察提醒';
  }
  
  private getAlertMessage(type: string, text: string): string {
    const snippet = text.slice(0, 50);
    const messages: Record<string, string> = {
      negotiation: `检测到价格讨论: "${snippet}..."，建议准备谈判策略`,
      contract: `合同相关话题: "${snippet}..."，请注意条款细节`,
      urgent: `紧急事项提及: "${snippet}..."，需要立即关注`,
      competitive: `竞争对手相关: "${snippet}..."，建议收集情报`,
      opportunity: `潜在商机: "${snippet}..."，值得深入了解`,
    };
    return messages[type] || `发现重要信息: "${snippet}..."`;
  }
  
  async processVisualFrame(frame: VisualFrame, deviceId: string): Promise<void> {
    if (!this.sentryActive || (this.mode !== 'WATCHING' && this.mode !== 'FULL_SENSE')) {
      return;
    }
    
    this.visualBuffer.push(frame);
    
    if (this.visualBuffer.length > 30) {
      this.visualBuffer = this.visualBuffer.slice(-15);
    }
    
    if (frame.changeScore >= this.config.changeDetectionThreshold) {
      await this.analyzeVisualChange(frame, deviceId);
    }
  }
  
  private async analyzeVisualChange(frame: VisualFrame, deviceId: string): Promise<void> {
    if (frame.detectedObjects && frame.detectedObjects.length > 0) {
      const importantObjects = frame.detectedObjects.filter(obj => 
        ['document', 'contract', 'person', 'phone', 'laptop'].includes(obj.label.toLowerCase())
      );
      
      for (const obj of importantObjects) {
        if (obj.label.toLowerCase() === 'document' || obj.label.toLowerCase() === 'contract') {
          await this.createProactiveAlert({
            type: 'action_needed',
            priority: 'medium',
            title: '文档检测',
            message: `检测到${obj.label}，需要分析内容吗？`,
            context: { object: obj, deviceId },
            suggestedAction: 'analyze_document',
          });
        }
      }
    }
    
    if (frame.ocrText) {
      await this.analyzeDocumentText(frame.ocrText, deviceId);
    }
    
    this.notifyAnalysisCallbacks({
      type: 'visual',
      frame,
      deviceId,
    });
  }
  
  private async analyzeDocumentText(text: string, deviceId: string): Promise<void> {
    const riskPatterns = [
      { pattern: /不可撤销|irrevocable/i, risk: 'high', desc: '不可撤销条款' },
      { pattern: /违约金|罚款|penalty/i, risk: 'medium', desc: '违约金条款' },
      { pattern: /排他性|exclusive/i, risk: 'medium', desc: '排他性条款' },
      { pattern: /自动续约|auto.?renew/i, risk: 'low', desc: '自动续约条款' },
      { pattern: /保密|confidential/i, risk: 'low', desc: '保密条款' },
    ];
    
    const foundRisks: { risk: string; desc: string }[] = [];
    
    for (const { pattern, risk, desc } of riskPatterns) {
      if (pattern.test(text)) {
        foundRisks.push({ risk, desc });
      }
    }
    
    if (foundRisks.length > 0) {
      const highRisks = foundRisks.filter(r => r.risk === 'high');
      
      await this.createProactiveAlert({
        type: 'warning',
        priority: highRisks.length > 0 ? 'high' : 'medium',
        title: '合同风险提醒',
        message: `检测到${foundRisks.length}个注意条款: ${foundRisks.map(r => r.desc).join(', ')}`,
        context: { risks: foundRisks, deviceId },
        hapticPattern: highRisks.length > 0 ? 'pattern' : 'short',
        suggestedAction: 'review_contract',
      });
    }
  }
  
  async createProactiveAlert(alert: Omit<ProactiveAlert, 'id' | 'createdAt' | 'acknowledged'>): Promise<ProactiveAlert> {
    const fullAlert: ProactiveAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
      acknowledged: false,
    };
    
    this.alertQueue.push(fullAlert);
    
    if (this.alertQueue.length > this.config.maxAlertQueue) {
      this.alertQueue = this.alertQueue.slice(-this.config.maxAlertQueue);
    }
    
    logger.info(`[DeviceSentry] Alert created: ${fullAlert.type} - ${fullAlert.title}`);
    
    this.notifyAnalysisCallbacks({
      type: 'alert',
      alert: fullAlert,
    });
    
    return fullAlert;
  }
  
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertQueue.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
  
  getPendingAlerts(): ProactiveAlert[] {
    return this.alertQueue.filter(a => !a.acknowledged);
  }
  
  getAllAlerts(): ProactiveAlert[] {
    return [...this.alertQueue];
  }
  
  onAnalysis(callback: (data: SentryAnalysisEvent) => void): void {
    this.analysisCallbacks.push(callback);
  }
  
  private notifyAnalysisCallbacks(data: SentryAnalysisEvent): void {
    for (const callback of this.analysisCallbacks) {
      try {
        callback(data);
      } catch (error) {
        logger.error({ error }, 'Callback error');
      }
    }
  }
  
  getConnectedDevices(): DeviceConnection[] {
    return Array.from(this.connectedDevices.values());
  }
  
  getDevice(deviceId: string): DeviceConnection | undefined {
    return this.connectedDevices.get(deviceId);
  }
  
  getBestDeviceForTask(task: 'audio' | 'visual' | 'haptic' | 'display'): DeviceConnection | null {
    const devices = Array.from(this.connectedDevices.values())
      .filter(d => d.status === 'connected');
    
    if (devices.length === 0) return null;
    
    switch (task) {
      case 'audio':
        return devices.find(d => d.capabilities.hasMicrophone) || null;
      case 'visual':
        return devices.find(d => d.capabilities.hasCamera) || 
               devices.find(d => d.deviceType === 'glasses') || null;
      case 'haptic':
        return devices.find(d => d.capabilities.hasHaptic) ||
               devices.find(d => d.deviceType === 'phone' || d.deviceType === 'watch') || null;
      case 'display':
        return devices.find(d => d.capabilities.hasDisplay && d.deviceType === 'glasses') ||
               devices.find(d => d.capabilities.hasDisplay) || null;
      default:
        return devices[0] || null;
    }
  }
  
  async sendHapticFeedback(deviceId: string, pattern: ProactiveAlert['hapticPattern']): Promise<boolean> {
    const device = this.connectedDevices.get(deviceId);
    if (!device || !device.capabilities.hasHaptic) {
      return false;
    }
    
    logger.info(`[DeviceSentry] Sending haptic feedback to ${deviceId}: ${pattern}`);
    return true;
  }
  
  setStealthMode(enabled: boolean): void {
    this.config.stealthMode = enabled;
    if (enabled) {
      this.mode = 'STEALTH';
    }
    logger.info(`[DeviceSentry] Stealth mode: ${enabled ? 'ON' : 'OFF'}`);
  }
}

export const deviceSentry = new DeviceSentryService();

export { DeviceSentryService };
