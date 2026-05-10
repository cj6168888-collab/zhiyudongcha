/**
 * 小智 Haptic Codes Protocol - 震动暗号协议
 * Project "Action Power" (执行力协议)
 * 
 * 通过震动模式向用户传递隐秘信息
 * 支持手机震动马达和AR眼镜触觉反馈
 * 
 * 暗号类型:
 * - ALERT: 警报 - 对方在撒谎/危险信号
 * - OPPORTUNITY: 机会 - 可以推进/有利时机
 * - CAUTION: 谨慎 - 需要小心/注意措辞
 * - CONFIRM: 确认 - 操作成功/信息准确
 * - URGENT: 紧急 - 需要立即关注
 * - RELAX: 放松 - 一切正常/可以放心
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
import { WebSocket } from 'ws';

const logger = createServiceLogger('HapticCodes');

export type HapticCodeType = 
  | 'ALERT'        // 警报：双击震动
  | 'OPPORTUNITY'  // 机会：长震动
  | 'CAUTION'      // 谨慎：三次短震
  | 'CONFIRM'      // 确认：单次短震
  | 'URGENT'       // 紧急：连续快震
  | 'RELAX'        // 放松：渐弱震动
  | 'LIE_DETECTED' // 谎言检测：急促双震
  | 'PRICE_HIGH'   // 价格过高：三次长震
  | 'DEAL_GOOD'    // 交易有利：两次短震+长震
  | 'HEALTH_ALERT' // 健康警告：持续震动
  | 'MEETING_END'  // 会议结束提醒：渐强震动
  | 'SILENT_EXIT'; // 静默离开信号：极轻单震

export interface HapticPattern {
  type: HapticCodeType;
  pattern: number[];
  intensity: number;
  description: string;
  category: 'WARNING' | 'INFO' | 'SUCCESS' | 'HEALTH' | 'SOCIAL';
}

export interface HapticMessage {
  id: string;
  code: HapticCodeType;
  context: string;
  details?: Record<string, any>;
  timestamp: Date;
  deviceTargets: ('PHONE' | 'GLASSES' | 'WATCH')[];
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  acknowledged: boolean;
}

export interface HapticConfig {
  enabled: boolean;
  intensity: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  allowedCodes: HapticCodeType[];
  preferredDevice: 'PHONE' | 'GLASSES' | 'WATCH' | 'ALL';
}

const HAPTIC_PATTERNS: Record<HapticCodeType, HapticPattern> = {
  ALERT: {
    type: 'ALERT',
    pattern: [100, 50, 100],
    intensity: 0.9,
    description: '警报：对方可能在撒谎或有危险信号',
    category: 'WARNING',
  },
  OPPORTUNITY: {
    type: 'OPPORTUNITY',
    pattern: [300],
    intensity: 0.7,
    description: '机会出现：可以推进谈判或行动',
    category: 'SUCCESS',
  },
  CAUTION: {
    type: 'CAUTION',
    pattern: [50, 30, 50, 30, 50],
    intensity: 0.6,
    description: '需要谨慎：注意措辞或行为',
    category: 'WARNING',
  },
  CONFIRM: {
    type: 'CONFIRM',
    pattern: [80],
    intensity: 0.5,
    description: '确认成功：操作已完成',
    category: 'SUCCESS',
  },
  URGENT: {
    type: 'URGENT',
    pattern: [50, 20, 50, 20, 50, 20, 50, 20, 50],
    intensity: 1.0,
    description: '紧急事项：需要立即关注',
    category: 'WARNING',
  },
  RELAX: {
    type: 'RELAX',
    pattern: [200, 100, 150, 100, 100],
    intensity: 0.4,
    description: '放松信号：一切正常',
    category: 'INFO',
  },
  LIE_DETECTED: {
    type: 'LIE_DETECTED',
    pattern: [80, 30, 80],
    intensity: 0.95,
    description: '谎言检测：对方陈述可能不实',
    category: 'WARNING',
  },
  PRICE_HIGH: {
    type: 'PRICE_HIGH',
    pattern: [200, 50, 200, 50, 200],
    intensity: 0.8,
    description: '价格过高：建议压价',
    category: 'WARNING',
  },
  DEAL_GOOD: {
    type: 'DEAL_GOOD',
    pattern: [50, 30, 50, 100, 200],
    intensity: 0.7,
    description: '交易有利：条件对我方有利',
    category: 'SUCCESS',
  },
  HEALTH_ALERT: {
    type: 'HEALTH_ALERT',
    pattern: [500],
    intensity: 0.9,
    description: '健康警告：需要休息或干预',
    category: 'HEALTH',
  },
  MEETING_END: {
    type: 'MEETING_END',
    pattern: [50, 50, 100, 50, 150, 50, 200],
    intensity: 0.6,
    description: '会议结束提醒：时间快到了',
    category: 'INFO',
  },
  SILENT_EXIT: {
    type: 'SILENT_EXIT',
    pattern: [30],
    intensity: 0.3,
    description: '静默离开信号：可以悄悄离开',
    category: 'SOCIAL',
  },
};

const CONTEXT_TO_CODE: Record<string, HapticCodeType> = {
  'lie_probability_high': 'LIE_DETECTED',
  'price_above_market': 'PRICE_HIGH',
  'favorable_terms': 'DEAL_GOOD',
  'heart_rate_elevated': 'HEALTH_ALERT',
  'meeting_5min_left': 'MEETING_END',
  'opportunity_detected': 'OPPORTUNITY',
  'caution_advised': 'CAUTION',
  'danger_signal': 'ALERT',
  'task_completed': 'CONFIRM',
  'all_clear': 'RELAX',
  'immediate_attention': 'URGENT',
  'exit_possible': 'SILENT_EXIT',
};

class HapticCodesService {
  private config: HapticConfig = {
    enabled: true,
    intensity: 0.8,
    allowedCodes: Object.keys(HAPTIC_PATTERNS) as HapticCodeType[],
    preferredDevice: 'ALL',
  };
  
  private messageHistory: HapticMessage[] = [];
  private activeConnections: Map<string, { deviceType: string; ws?: WebSocket }> = new Map();
  
  getPattern(code: HapticCodeType): HapticPattern {
    return HAPTIC_PATTERNS[code];
  }
  
  getAllPatterns(): HapticPattern[] {
    return Object.values(HAPTIC_PATTERNS);
  }
  
  mapContextToCode(context: string): HapticCodeType | null {
    const normalizedContext = context.toLowerCase().replace(/\s+/g, '_');
    return CONTEXT_TO_CODE[normalizedContext] || null;
  }
  
  async sendHapticSignal(data: {
    code: HapticCodeType;
    context: string;
    details?: Record<string, any>;
    devices?: ('PHONE' | 'GLASSES' | 'WATCH')[];
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  }): Promise<HapticMessage> {
    if (!this.config.enabled) {
      throw new Error('触觉反馈已禁用');
    }
    
    if (!this.config.allowedCodes.includes(data.code)) {
      throw new Error(`暗号类型 ${data.code} 未启用`);
    }
    
    if (this.isQuietHours()) {
      const pattern = this.getPattern(data.code);
      if (pattern.category !== 'WARNING' && data.priority !== 'CRITICAL') {
        throw new Error('静默时段，仅允许紧急警告');
      }
    }
    
    const message: HapticMessage = {
      id: `haptic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      code: data.code,
      context: data.context,
      details: data.details,
      timestamp: new Date(),
      deviceTargets: data.devices || this.getTargetDevices(),
      priority: data.priority || 'NORMAL',
      acknowledged: false,
    };
    
    await this.dispatchToDevices(message);
    
    this.messageHistory.push(message);
    if (this.messageHistory.length > 100) {
      this.messageHistory = this.messageHistory.slice(-100);
    }
    
    logger.info(`[HapticCodes] 发送暗号: ${data.code} - ${data.context}`);
    
    return message;
  }
  
  private async dispatchToDevices(message: HapticMessage): Promise<void> {
    const pattern = this.getPattern(message.code);
    const adjustedPattern = pattern.pattern.map(p => 
      Math.round(p * this.config.intensity)
    );
    
    for (const device of message.deviceTargets) {
      const connection = this.findDeviceConnection(device);
      if (connection) {
        try {
          if (connection.ws && connection.ws.readyState === 1) {
            connection.ws.send(JSON.stringify({
              type: 'HAPTIC_SIGNAL',
              code: message.code,
              pattern: adjustedPattern,
              intensity: pattern.intensity * this.config.intensity,
              priority: message.priority,
            }));
          }
        } catch (error) {
          logger.error({ error, device }, '发送到设备失败');
        }
      }
    }
  }
  
  private findDeviceConnection(deviceType: string): { deviceType: string; ws?: WebSocket } | undefined {
    for (const [_, conn] of Array.from(this.activeConnections.entries())) {
      if (conn.deviceType === deviceType) {
        return conn;
      }
    }
    return undefined;
  }
  
  private getTargetDevices(): ('PHONE' | 'GLASSES' | 'WATCH')[] {
    if (this.config.preferredDevice === 'ALL') {
      return ['PHONE', 'GLASSES', 'WATCH'];
    }
    return [this.config.preferredDevice];
  }
  
  private isQuietHours(): boolean {
    if (!this.config.quietHoursStart || !this.config.quietHoursEnd) {
      return false;
    }
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if (this.config.quietHoursStart <= this.config.quietHoursEnd) {
      return currentTime >= this.config.quietHoursStart && currentTime <= this.config.quietHoursEnd;
    } else {
      return currentTime >= this.config.quietHoursStart || currentTime <= this.config.quietHoursEnd;
    }
  }
  
  registerDevice(deviceId: string, deviceType: 'PHONE' | 'GLASSES' | 'WATCH', ws?: WebSocket): void {
    this.activeConnections.set(deviceId, { deviceType, ws });
    logger.info(`[HapticCodes] 设备已注册: ${deviceId} (${deviceType})`);
  }
  
  unregisterDevice(deviceId: string): void {
    this.activeConnections.delete(deviceId);
    logger.info(`[HapticCodes] 设备已注销: ${deviceId}`);
  }
  
  acknowledgeMessage(messageId: string): boolean {
    const message = this.messageHistory.find(m => m.id === messageId);
    if (message) {
      message.acknowledged = true;
      return true;
    }
    return false;
  }
  
  getRecentMessages(limit: number = 20): HapticMessage[] {
    return this.messageHistory.slice(-limit);
  }
  
  getUnacknowledgedMessages(): HapticMessage[] {
    return this.messageHistory.filter(m => !m.acknowledged);
  }
  
  updateConfig(updates: Partial<HapticConfig>): HapticConfig {
    this.config = { ...this.config, ...updates };
    return this.config;
  }
  
  getConfig(): HapticConfig {
    return { ...this.config };
  }
  
  async sendQuickAlert(alertType: 'LIE' | 'OPPORTUNITY' | 'DANGER' | 'SUCCESS' | 'HEALTH'): Promise<HapticMessage> {
    const mapping: Record<string, { code: HapticCodeType; context: string }> = {
      LIE: { code: 'LIE_DETECTED', context: '检测到可疑陈述' },
      OPPORTUNITY: { code: 'OPPORTUNITY', context: '发现有利机会' },
      DANGER: { code: 'ALERT', context: '检测到危险信号' },
      SUCCESS: { code: 'CONFIRM', context: '操作成功完成' },
      HEALTH: { code: 'HEALTH_ALERT', context: '健康状况需要关注' },
    };
    
    const { code, context } = mapping[alertType];
    return this.sendHapticSignal({ code, context, priority: 'HIGH' });
  }
  
  async sendNegotiationHint(hint: 'PUSH' | 'HOLD' | 'RETREAT' | 'CLOSE'): Promise<HapticMessage> {
    const mapping: Record<string, { code: HapticCodeType; context: string }> = {
      PUSH: { code: 'OPPORTUNITY', context: '可以推进，对方有松动' },
      HOLD: { code: 'CAUTION', context: '保持现状，观察对方反应' },
      RETREAT: { code: 'ALERT', context: '建议后退，风险升高' },
      CLOSE: { code: 'DEAL_GOOD', context: '可以成交，条件有利' },
    };
    
    const { code, context } = mapping[hint];
    return this.sendHapticSignal({ code, context, priority: 'HIGH' });
  }
  
  getDeviceStatus(): { deviceId: string; deviceType: string; connected: boolean }[] {
    return Array.from(this.activeConnections.entries()).map(([deviceId, conn]) => ({
      deviceId,
      deviceType: conn.deviceType,
      connected: conn.ws ? conn.ws.readyState === 1 : false,
    }));
  }
}

export const hapticCodes = new HapticCodesService();
export default hapticCodes;
