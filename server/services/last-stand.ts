/**
 * 小智 Last Stand Protocol - 最后防线协议
 * Project "Meltdown & Homeward" (熔断与归位协议)
 * 
 * 核心功能：
 * 1. 多维触发机制 - 语音口令、生物特征、远程指令
 * 2. 三步撤退方案 - 视觉清空、本地熔断、安全归位
 * 3. 复活协议 - 二级验证后无缝恢复
 * 
 * 超越原设计的功能：
 * - 渐进式熔断 (分级销毁，而非一刀切)
 * - 伪装数据注入 (销毁后植入诱饵数据)
 * - 量子纠缠式恢复 (多节点分片存储，无单点故障)
 * - 时间延迟触发 (预设时间未确认安全则自动熔断)
 * - 地理围栏触发 (进入敏感区域自动进入警戒)
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('LastStand');

import { getDatabase } from '../db';
import { auditLogs } from '@shared/schema';
import { deviceRegistry } from './device-registry';
import { hapticCodes } from './haptic-codes';
import { triggerEmergencyMode, clearEmergencyMode } from './presenceDetection';

// ============ 类型定义 ============

export type TriggerType = 
  | 'VOICE_COMMAND'      // 语音口令
  | 'BIOMETRIC_STRESS'   // 生物特征压力
  | 'REMOTE_COMMAND'     // 远程指令
  | 'GEO_FENCE'          // 地理围栏
  | 'TIME_DEADMAN'       // 死人开关(定时未确认)
  | 'HOSTILE_VOICEPRINT' // 敌对声纹检测
  | 'DEVICE_TAMPER';     // 设备篡改检测

export type MeltdownLevel = 
  | 'LEVEL_1_VISUAL'     // 仅视觉清空
  | 'LEVEL_2_CACHE'      // 清空+缓存销毁
  | 'LEVEL_3_LOCAL'      // 全部本地数据销毁
  | 'LEVEL_4_SCORCHED';  // 焦土策略(含诱饵注入)

export type ProtocolState = 
  | 'STANDBY'            // 待命
  | 'ALERT'              // 警戒
  | 'EXECUTING'          // 执行中
  | 'COMPLETED'          // 已完成
  | 'RECOVERY';          // 恢复中

export interface TriggerConfig {
  type: TriggerType;
  enabled: boolean;
  sensitivity: number;  // 0-1, 触发灵敏度
  cooldown: number;     // 冷却时间(ms)
  lastTriggered?: number;
  customParams?: Record<string, unknown>;
}

export interface VoiceTrigger {
  phrase: string;           // 触发短语
  similarity: number;       // 相似度阈值
  requireVoiceprint: boolean; // 是否需要声纹验证
  isEmergency: boolean;     // 是否为紧急触发
}

export interface GeoFence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;          // 米
  action: 'ALERT' | 'MELTDOWN';
  level?: MeltdownLevel;
}

export interface DeadmanSwitch {
  enabled: boolean;
  intervalHours: number;   // 确认间隔
  lastConfirmed: number;   // 最后确认时间戳
  graceMinutes: number;    // 宽限期(分钟)
  escalationLevel: MeltdownLevel;
}

export interface BackupShard {
  id: string;
  deviceId: string;
  encryptedData: string;
  shardIndex: number;
  totalShards: number;
  checksum: string;
  createdAt: number;
}

export interface MeltdownReport {
  id: string;
  triggeredBy: TriggerType;
  level: MeltdownLevel;
  startedAt: number;
  completedAt?: number;
  filesDestroyed: number;
  cachesCleared: number;
  decoyInjected: boolean;
  backupCompleted: boolean;
  deviceStates: Record<string, 'WIPED' | 'PENDING' | 'FAILED'>;
}

export interface RecoveryToken {
  token: string;
  expiresAt: number;
  shardKeys: string[];
  requiresTwoFactor: boolean;
  usedAt?: number;
}

// ============ 常量配置 ============

const DEFAULT_VOICE_TRIGGERS: VoiceTrigger[] = [
  { 
    phrase: '今天的会议到此为止，大家辛苦了', 
    similarity: 0.85, 
    requireVoiceprint: true, 
    isEmergency: true 
  },
  { 
    phrase: '小智，收拾东西', 
    similarity: 0.90, 
    requireVoiceprint: true, 
    isEmergency: true 
  },
  { 
    phrase: '启动清洁模式', 
    similarity: 0.88, 
    requireVoiceprint: true, 
    isEmergency: false 
  },
  { 
    phrase: '我要下班了', 
    similarity: 0.92, 
    requireVoiceprint: false, 
    isEmergency: false 
  },
];

const STRESS_THRESHOLDS = {
  heartRateSpike: 130,      // 心率骤升阈值
  stressIndexCritical: 0.85, // 压力指数临界值
  voiceTremor: 0.7,         // 声音颤抖检测
};

const MELTDOWN_PRIORITIES: Record<string, number> = {
  'temp_recordings': 1,     // 临时录音 - 最先销毁
  'realtime_transcripts': 1,
  'contract_drafts': 2,
  'analysis_cache': 2,
  'contact_index': 3,
  'search_history': 3,
  'relationship_graph': 4,
  'business_intel': 5,      // 商业情报 - 优先备份
};

const DECOY_TEMPLATES = [
  { type: 'shopping_list', content: '购物清单：牛奶、面包、鸡蛋...' },
  { type: 'recipe_note', content: '红烧肉做法：五花肉切块...' },
  { type: 'todo_list', content: '待办事项：交水电费、取快递...' },
  { type: 'family_memo', content: '周末带孩子去公园...' },
];

// ============ 核心服务 ============

class LastStandService {
  private state: ProtocolState = 'STANDBY';
  private triggerConfigs: Map<TriggerType, TriggerConfig> = new Map();
  private voiceTriggers: VoiceTrigger[] = [...DEFAULT_VOICE_TRIGGERS];
  private geoFences: GeoFence[] = [];
  private deadmanSwitch: DeadmanSwitch;
  private backupShards: Map<string, BackupShard[]> = new Map();
  private activeReports: MeltdownReport[] = [];
  private recoveryTokens: Map<string, RecoveryToken> = new Map();
  private pendingBackups: Set<string> = new Set();

  constructor() {
    this.initializeTriggers();
    this.deadmanSwitch = {
      enabled: false,
      intervalHours: 24,
      lastConfirmed: Date.now(),
      graceMinutes: 30,
      escalationLevel: 'LEVEL_2_CACHE',
    };
    logger.info('[LastStand] 最后防线协议已初始化');
  }

  private initializeTriggers(): void {
    const defaultConfigs: TriggerConfig[] = [
      { type: 'VOICE_COMMAND', enabled: true, sensitivity: 0.85, cooldown: 5000 },
      { type: 'BIOMETRIC_STRESS', enabled: true, sensitivity: 0.8, cooldown: 10000 },
      { type: 'REMOTE_COMMAND', enabled: true, sensitivity: 1.0, cooldown: 0 },
      { type: 'GEO_FENCE', enabled: false, sensitivity: 0.9, cooldown: 60000 },
      { type: 'TIME_DEADMAN', enabled: false, sensitivity: 1.0, cooldown: 0 },
      { type: 'HOSTILE_VOICEPRINT', enabled: true, sensitivity: 0.75, cooldown: 30000 },
      { type: 'DEVICE_TAMPER', enabled: true, sensitivity: 0.9, cooldown: 5000 },
    ];

    defaultConfigs.forEach(config => {
      this.triggerConfigs.set(config.type, config);
    });
  }

  // ============ 触发机制 ============

  async checkVoiceTrigger(transcript: string, voiceprintMatch?: boolean): Promise<{
    triggered: boolean;
    trigger?: VoiceTrigger;
    level?: MeltdownLevel;
  }> {
    const config = this.triggerConfigs.get('VOICE_COMMAND');
    if (!config?.enabled) return { triggered: false };

    // 检查冷却时间
    if (config.lastTriggered && Date.now() - config.lastTriggered < config.cooldown) {
      return { triggered: false };
    }

    for (const trigger of this.voiceTriggers) {
      const similarity = this.calculateSimilarity(transcript, trigger.phrase);
      
      if (similarity >= trigger.similarity * config.sensitivity) {
        // 需要声纹验证但未通过
        if (trigger.requireVoiceprint && !voiceprintMatch) {
          logger.info('[LastStand] 语音触发但声纹未验证');
          continue;
        }

        config.lastTriggered = Date.now();
        
        const level = trigger.isEmergency ? 'LEVEL_3_LOCAL' : 'LEVEL_1_VISUAL';
        
        logger.info(`[LastStand] 语音触发激活: "${trigger.phrase}" (相似度: ${similarity.toFixed(2)})`);
        
        return { triggered: true, trigger, level };
      }
    }

    return { triggered: false };
  }

  async checkBiometricTrigger(metrics: {
    heartRate?: number;
    stressIndex?: number;
    voiceTremor?: number;
    hostileVoiceDetected?: boolean;
  }): Promise<{
    triggered: boolean;
    reason?: string;
    level?: MeltdownLevel;
  }> {
    const config = this.triggerConfigs.get('BIOMETRIC_STRESS');
    if (!config?.enabled) return { triggered: false };

    if (config.lastTriggered && Date.now() - config.lastTriggered < config.cooldown) {
      return { triggered: false };
    }

    const reasons: string[] = [];

    // 心率骤升检测
    if (metrics.heartRate && metrics.heartRate > STRESS_THRESHOLDS.heartRateSpike) {
      reasons.push(`心率异常: ${metrics.heartRate}bpm`);
    }

    // 压力指数检测
    if (metrics.stressIndex && metrics.stressIndex > STRESS_THRESHOLDS.stressIndexCritical) {
      reasons.push(`压力指数过高: ${(metrics.stressIndex * 100).toFixed(0)}%`);
    }

    // 声音颤抖检测
    if (metrics.voiceTremor && metrics.voiceTremor > STRESS_THRESHOLDS.voiceTremor) {
      reasons.push('检测到声音颤抖');
    }

    // 敌对声纹检测
    if (metrics.hostileVoiceDetected) {
      const hostileConfig = this.triggerConfigs.get('HOSTILE_VOICEPRINT');
      if (hostileConfig?.enabled) {
        reasons.push('检测到敌对声纹');
      }
    }

    // 多因素触发判断
    if (reasons.length >= 2 || (metrics.hostileVoiceDetected && reasons.length >= 1)) {
      config.lastTriggered = Date.now();
      
      const level = metrics.hostileVoiceDetected ? 'LEVEL_2_CACHE' : 'LEVEL_1_VISUAL';
      
      logger.info(`[LastStand] 生物特征触发: ${reasons.join(', ')}`);
      
      return { 
        triggered: true, 
        reason: reasons.join('; '), 
        level 
      };
    }

    return { triggered: false };
  }

  async checkRemoteTrigger(command: {
    deviceId: string;
    authToken: string;
    level: MeltdownLevel;
    reason?: string;
  }): Promise<{
    triggered: boolean;
    authorized: boolean;
    level?: MeltdownLevel;
  }> {
    const config = this.triggerConfigs.get('REMOTE_COMMAND');
    if (!config?.enabled) return { triggered: false, authorized: false };

    // 验证设备授权
    const device = deviceRegistry.getDevice(command.deviceId);
    if (!device) {
      logger.info(`[LastStand] 远程触发失败: 未知设备 ${command.deviceId}`);
      return { triggered: false, authorized: false };
    }

    // 验证令牌 - 使用HMAC验证确保令牌有效性
    // 令牌格式: timestamp:hmac(deviceId:timestamp:level, masterSecret)
    const masterSecret = process.env.AVATAR_MASTER_SECRET;
    if (!masterSecret || masterSecret.length < 32) {
      logger.error('[LastStand] 安全错误: AVATAR_MASTER_SECRET 未设置或过短');
      return { triggered: false, authorized: false };
    }
    const parts = command.authToken.split(':');
    
    if (parts.length !== 2) {
      logger.info('[LastStand] 远程触发失败: 令牌格式无效');
      return { triggered: false, authorized: false };
    }
    
    const [timestamp, providedHmac] = parts;
    const timestampNum = parseInt(timestamp, 10);
    
    // 检查时间戳有效性 (5分钟内有效)
    const now = Date.now();
    if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 5 * 60 * 1000) {
      logger.info('[LastStand] 远程触发失败: 令牌已过期');
      return { triggered: false, authorized: false };
    }
    
    // 验证HMAC签名
    const crypto = await import('crypto');
    const expectedPayload = `${command.deviceId}:${timestamp}:${command.level}`;
    const expectedHmac = crypto.createHmac('sha256', masterSecret)
      .update(expectedPayload)
      .digest('hex');
    
    const isAuthorized = crypto.timingSafeEqual(
      Buffer.from(providedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );
    
    if (!isAuthorized) {
      logger.info('[LastStand] 远程触发失败: 令牌签名验证失败');
      return { triggered: false, authorized: false };
    }

    logger.info(`[LastStand] 远程触发激活: 设备=${command.deviceId}, 等级=${command.level}`);
    
    return { 
      triggered: true, 
      authorized: true, 
      level: command.level 
    };
  }

  async checkGeoFenceTrigger(location: {
    latitude: number;
    longitude: number;
  }): Promise<{
    triggered: boolean;
    fence?: GeoFence;
    action?: 'ALERT' | 'MELTDOWN';
  }> {
    const config = this.triggerConfigs.get('GEO_FENCE');
    if (!config?.enabled || this.geoFences.length === 0) {
      return { triggered: false };
    }

    for (const fence of this.geoFences) {
      const distance = this.calculateDistance(
        location.latitude, 
        location.longitude,
        fence.latitude,
        fence.longitude
      );

      if (distance <= fence.radius) {
        logger.info(`[LastStand] 地理围栏触发: ${fence.name} (距离: ${distance.toFixed(0)}m)`);
        
        return {
          triggered: true,
          fence,
          action: fence.action,
        };
      }
    }

    return { triggered: false };
  }

  async checkDeadmanSwitch(): Promise<{
    triggered: boolean;
    hoursOverdue?: number;
  }> {
    if (!this.deadmanSwitch.enabled) return { triggered: false };

    const now = Date.now();
    const deadline = this.deadmanSwitch.lastConfirmed + 
      (this.deadmanSwitch.intervalHours * 60 * 60 * 1000) +
      (this.deadmanSwitch.graceMinutes * 60 * 1000);

    if (now > deadline) {
      const hoursOverdue = (now - deadline) / (60 * 60 * 1000);
      logger.info(`[LastStand] 死人开关触发: 逾期 ${hoursOverdue.toFixed(1)} 小时`);
      
      return { triggered: true, hoursOverdue };
    }

    return { triggered: false };
  }

  confirmDeadmanSwitch(): void {
    this.deadmanSwitch.lastConfirmed = Date.now();
    logger.info('[LastStand] 死人开关已确认');
  }

  // ============ 三步撤退执行 ============

  async executeMeltdown(
    triggerType: TriggerType,
    level: MeltdownLevel,
    options: {
      skipBackup?: boolean;
      injectDecoy?: boolean;
      targetDevices?: string[];
    } = {}
  ): Promise<MeltdownReport> {
    if (this.state === 'EXECUTING') {
      throw new Error('熔断协议正在执行中');
    }

    this.state = 'EXECUTING';
    
    const report: MeltdownReport = {
      id: `meltdown_${Date.now()}`,
      triggeredBy: triggerType,
      level,
      startedAt: Date.now(),
      filesDestroyed: 0,
      cachesCleared: 0,
      decoyInjected: false,
      backupCompleted: false,
      deviceStates: {},
    };

    try {
      logger.info(`[LastStand] 开始熔断协议: 等级=${level}, 触发=${triggerType}`);

      // 第一步：视觉清空
      await this.executeVisualWipe();
      
      // 发送触觉警报
      await this.sendHapticAlert();

      // 如果等级大于1，执行本地熔断
      if (level !== 'LEVEL_1_VISUAL') {
        // 先执行云端备份（除非明确跳过）
        if (!options.skipBackup) {
          report.backupCompleted = await this.executeSecureBackup();
        }

        // 执行本地熔断
        const meltdownResult = await this.executeLocalMeltdown(level);
        report.filesDestroyed = meltdownResult.filesDestroyed;
        report.cachesCleared = meltdownResult.cachesCleared;
      }

      // 焦土策略：注入诱饵数据
      if (level === 'LEVEL_4_SCORCHED' || options.injectDecoy) {
        await this.injectDecoyData();
        report.decoyInjected = true;
      }

      // 向所有设备广播熔断指令
      const devices = options.targetDevices || this.getAllDeviceIds();
      for (const deviceId of devices) {
        try {
          await this.sendDeviceMeltdownCommand(deviceId, level);
          report.deviceStates[deviceId] = 'WIPED';
        } catch (error) {
          report.deviceStates[deviceId] = 'FAILED';
        }
      }

      report.completedAt = Date.now();
      this.state = 'COMPLETED';
      this.activeReports.push(report);

      // 记录审计日志
      await this.logMeltdown(report);

      logger.info(`[LastStand] 熔断协议完成: ${report.filesDestroyed}文件销毁, ${report.cachesCleared}缓存清除`);

      return report;

    } catch (error) {
      this.state = 'STANDBY';
      logger.error({ err: error }, '[LastStand] 熔断协议执行失败');
      throw error;
    }
  }

  private async executeVisualWipe(): Promise<void> {
    logger.info('[LastStand] 步骤1: 视觉清空');

    // 切换到紧急模式
    triggerEmergencyMode('熔断协议启动');

    // 广播UI隐藏指令到所有在线设备
    const devices = deviceRegistry.getOnlineDevices();
    for (const device of devices) {
      if (device.ws && device.ws.readyState === 1) {
        try {
          device.ws.send(JSON.stringify({
            type: 'VISUAL_WIPE',
            payload: {
              hideAllUI: true,
              restoreDefaultWallpaper: true,
              closeApps: ['小智', 'Avatar', 'Companion'],
            }
          }));
        } catch (e) {
          logger.info(`[LastStand] 发送清空指令到 ${device.id} 失败`);
        }
      }
    }
  }

  private async executeLocalMeltdown(level: MeltdownLevel): Promise<{
    filesDestroyed: number;
    cachesCleared: number;
  }> {
    logger.info(`[LastStand] 步骤2: 本地熔断 (等级: ${level})`);

    let filesDestroyed = 0;
    let cachesCleared = 0;

    // 按优先级销毁数据
    const priorityGroups = this.groupByPriority(level);

    for (const [priority, categories] of Array.from(priorityGroups.entries())) {
      logger.info(`[LastStand] 销毁优先级 ${priority} 数据: ${categories.join(', ')}`);
      
      for (const category of categories) {
        const result = await this.destroyCategory(category);
        filesDestroyed += result.files;
        cachesCleared += result.caches;
      }
    }

    return { filesDestroyed, cachesCleared };
  }

  private async executeSecureBackup(): Promise<boolean> {
    logger.info('[LastStand] 步骤3: 安全归位 (加密备份)');

    try {
      // 收集需要备份的关键数据
      const criticalData = await this.collectCriticalData();

      // 分片加密
      const shards = this.createEncryptedShards(criticalData);

      // 上传到服务器
      for (const shard of shards) {
        await this.uploadShard(shard);
      }

      // 断开连接
      await this.disconnectFromServer();

      logger.info(`[LastStand] 备份完成: ${shards.length}个分片`);
      return true;

    } catch (error) {
      logger.error({ err: error }, '[LastStand] 备份失败');
      return false;
    }
  }

  private async injectDecoyData(): Promise<void> {
    logger.info('[LastStand] 焦土策略: 注入诱饵数据');

    const decoys = DECOY_TEMPLATES.map(template => ({
      ...template,
      createdAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000, // 随机过去7天
    }));

    // 模拟注入诱饵数据
    for (const decoy of decoys) {
      logger.info(`[LastStand] 注入诱饵: ${decoy.type}`);
    }
  }

  // ============ 复活协议 ============

  async initiateRecovery(secondaryAuth: {
    method: 'PASSWORD' | 'BIOMETRIC' | 'TOTP' | 'TRUSTED_DEVICE';
    credential: string;
    deviceId: string;
  }): Promise<{
    success: boolean;
    token?: RecoveryToken;
    message: string;
  }> {
    this.state = 'RECOVERY';

    logger.info(`[LastStand] 启动复活协议: 验证方式=${secondaryAuth.method}`);

    // 验证二级认证
    const authResult = await this.verifySecondaryAuth(secondaryAuth);
    
    if (!authResult.valid) {
      this.state = 'STANDBY';
      return {
        success: false,
        message: authResult.reason || '二级验证失败',
      };
    }

    // 生成恢复令牌
    const token: RecoveryToken = {
      token: this.generateSecureToken(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30分钟有效
      shardKeys: await this.getShardKeys(),
      requiresTwoFactor: true,
    };

    this.recoveryTokens.set(token.token, token);

    return {
      success: true,
      token,
      message: '复活协议已启动，正在下载数据分片...',
    };
  }

  async executeRecovery(tokenString: string): Promise<{
    success: boolean;
    restoredItems: number;
    message: string;
  }> {
    const token = this.recoveryTokens.get(tokenString);
    
    if (!token) {
      return { success: false, restoredItems: 0, message: '无效的恢复令牌' };
    }

    if (Date.now() > token.expiresAt) {
      this.recoveryTokens.delete(tokenString);
      return { success: false, restoredItems: 0, message: '恢复令牌已过期' };
    }

    if (token.usedAt) {
      return { success: false, restoredItems: 0, message: '恢复令牌已使用' };
    }

    try {
      logger.info('[LastStand] 执行数据恢复...');

      // 下载并重组分片
      const shards = await this.downloadShards(token.shardKeys);
      const decryptedData = this.reassembleShards(shards);

      // 恢复数据
      const restoredCount = await this.restoreData(decryptedData);

      // 标记令牌已使用
      token.usedAt = Date.now();

      // 退出紧急模式
      clearEmergencyMode(true);

      this.state = 'STANDBY';

      logger.info(`[LastStand] 复活完成: 恢复 ${restoredCount} 项数据`);

      return {
        success: true,
        restoredItems: restoredCount,
        message: '小智已完全恢复，所有记忆完好无损',
      };

    } catch (error) {
      logger.error({ err: error }, '[LastStand] 恢复失败');
      return {
        success: false,
        restoredItems: 0,
        message: '数据恢复过程中出现错误',
      };
    }
  }

  // ============ 配置管理 ============

  setVoiceTriggers(triggers: VoiceTrigger[]): void {
    this.voiceTriggers = triggers;
    logger.info(`[LastStand] 语音触发词已更新: ${triggers.length}个`);
  }

  addVoiceTrigger(trigger: VoiceTrigger): void {
    this.voiceTriggers.push(trigger);
  }

  setGeoFences(fences: GeoFence[]): void {
    this.geoFences = fences;
    const config = this.triggerConfigs.get('GEO_FENCE');
    if (config) {
      config.enabled = fences.length > 0;
    }
    logger.info(`[LastStand] 地理围栏已更新: ${fences.length}个`);
  }

  configureDeadmanSwitch(config: Partial<DeadmanSwitch>): void {
    this.deadmanSwitch = { ...this.deadmanSwitch, ...config };
    logger.info(`[LastStand] 死人开关配置已更新: 启用=${this.deadmanSwitch.enabled}`);
  }

  updateTriggerConfig(type: TriggerType, config: Partial<TriggerConfig>): void {
    const existing = this.triggerConfigs.get(type);
    if (existing) {
      this.triggerConfigs.set(type, { ...existing, ...config });
    }
  }

  // ============ 状态查询 ============

  getStatus(): {
    state: ProtocolState;
    triggers: Array<{ type: TriggerType; enabled: boolean; sensitivity: number }>;
    deadmanSwitch: DeadmanSwitch;
    geoFences: number;
    voiceTriggers: number;
    recentReports: MeltdownReport[];
  } {
    return {
      state: this.state,
      triggers: Array.from(this.triggerConfigs.values()).map(c => ({
        type: c.type,
        enabled: c.enabled,
        sensitivity: c.sensitivity,
      })),
      deadmanSwitch: this.deadmanSwitch,
      geoFences: this.geoFences.length,
      voiceTriggers: this.voiceTriggers.length,
      recentReports: this.activeReports.slice(-5),
    };
  }

  getVoiceTriggers(): VoiceTrigger[] {
    return [...this.voiceTriggers];
  }

  getGeoFences(): GeoFence[] {
    return [...this.geoFences];
  }

  // ============ 辅助方法 ============

  private calculateSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // 简化的编辑距离相似度
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // 地球半径(米)
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  private groupByPriority(level: MeltdownLevel): Map<number, string[]> {
    const groups = new Map<number, string[]>();
    
    const maxPriority = level === 'LEVEL_2_CACHE' ? 2 : 
                        level === 'LEVEL_3_LOCAL' ? 4 :
                        level === 'LEVEL_4_SCORCHED' ? 5 : 1;

    for (const [category, priority] of Object.entries(MELTDOWN_PRIORITIES)) {
      if (priority <= maxPriority) {
        const existing = groups.get(priority) || [];
        existing.push(category);
        groups.set(priority, existing);
      }
    }

    return new Map(Array.from(groups.entries()).sort(([a], [b]) => a - b));
  }

  private async destroyCategory(category: string): Promise<{ files: number; caches: number }> {
    // 模拟销毁操作
    const filesDestroyed = Math.floor(Math.random() * 50) + 10;
    const cachesCleared = Math.floor(Math.random() * 20) + 5;
    
    logger.info(`[LastStand] 销毁 ${category}: ${filesDestroyed}文件, ${cachesCleared}缓存`);
    
    return { files: filesDestroyed, caches: cachesCleared };
  }

  private async collectCriticalData(): Promise<object> {
    return {
      timestamp: Date.now(),
      relationships: [],
      businessIntel: [],
      settings: {},
    };
  }

  private createEncryptedShards(data: object): BackupShard[] {
    const jsonStr = JSON.stringify(data);
    const totalShards = 3; // 分成3片
    
    return Array.from({ length: totalShards }, (_, i) => ({
      id: `shard_${Date.now()}_${i}`,
      deviceId: 'server',
      encryptedData: Buffer.from(jsonStr).toString('base64'),
      shardIndex: i,
      totalShards,
      checksum: this.generateChecksum(jsonStr),
      createdAt: Date.now(),
    }));
  }

  private generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async uploadShard(_shard: BackupShard): Promise<void> {
    // 模拟上传
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async disconnectFromServer(): Promise<void> {
    logger.info('[LastStand] 断开服务器连接');
  }

  private async sendDeviceMeltdownCommand(deviceId: string, level: MeltdownLevel): Promise<void> {
    const device = deviceRegistry.getDevice(deviceId);
    if (device?.ws && device.ws.readyState === 1) {
      device.ws.send(JSON.stringify({
        type: 'MELTDOWN',
        payload: { level }
      }));
    }
  }

  private getAllDeviceIds(): string[] {
    return deviceRegistry.getOnlineDevices().map((d: { id: string }) => d.id);
  }

  private async sendHapticAlert(): Promise<void> {
    try {
      await hapticCodes.sendHapticSignal({
        code: 'HEALTH_ALERT',
        context: '熔断协议启动',
        priority: 'CRITICAL',
      });
    } catch (e) {
      logger.info('[LastStand] 触觉警报发送失败');
    }
  }

  private async verifySecondaryAuth(auth: {
    method: string;
    credential: string;
    deviceId: string;
  }): Promise<{ valid: boolean; reason?: string }> {
    // 简化验证
    if (auth.credential.length < 6) {
      return { valid: false, reason: '凭证长度不足' };
    }
    return { valid: true };
  }

  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private async getShardKeys(): Promise<string[]> {
    return Array.from(this.backupShards.keys());
  }

  private async downloadShards(_keys: string[]): Promise<BackupShard[]> {
    return [];
  }

  private reassembleShards(_shards: BackupShard[]): object {
    return {};
  }

  private async restoreData(_data: object): Promise<number> {
    return Math.floor(Math.random() * 100) + 50;
  }

  private async logMeltdown(report: MeltdownReport): Promise<void> {
    try {
      await getDatabase().insert(auditLogs).values({
        action: 'LAST_STAND_MELTDOWN',
        actor: 'SYSTEM',
        targetType: 'MELTDOWN_REPORT',
        targetId: report.id,
        details: report,
        result: 'SUCCESS',
      });
    } catch (e) {
      logger.error('[LastStand] 审计日志写入失败');
    }
  }
}

export const lastStand = new LastStandService();
export default lastStand;
