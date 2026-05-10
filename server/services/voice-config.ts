/**
 * 语音服务统一配置
 *
 * 集中管理所有语音相关配置：
 * - ASR (语音识别)
 * - TTS (语音合成)
 * - 声纹识别
 * - 持续监听
 *
 * 企业生产级别配置系统
 */

import { z } from 'zod';
import { getConfig as getBaseConfig } from '../lib/config';
import { createServiceLogger } from '../lib/logger';
const log = createServiceLogger('VoiceConfig');

// ==================== 配置模式定义 ====================

const asrConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['dashscope', 'whisper', 'offline']).default('dashscope'),
  model: z.string().default('paraformer-realtime-v2'),
  language: z.array(z.string()).default(['zh', 'en']),
  sampleRate: z.number().default(16000),
  format: z.enum(['wav', 'pcm', 'mp3']).default('wav'),
  // 实时参数
  realtimeEnabled: z.boolean().default(true),
  realtimeEndpoint: z.string().optional(),
  // 降级策略
  fallbackEnabled: z.boolean().default(true),
  fallbackProvider: z.enum(['whisper', 'offline']).optional(),
  // 并发限制
  maxConcurrent: z.number().default(10),
  timeout: z.number().default(30000),
});

const ttsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['dashscope', 'azure', 'offline']).default('dashscope'),
  model: z.string().default('cosyvoice-v3-flash'),
  voice: z.string().default('longhuhu_v3'),
  // 声音参数
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(0.5).max(2.0).default(1.0),
  volume: z.number().min(0).max(100).default(50),
  // 输出格式
  format: z.enum(['mp3', 'wav', 'pcm']).default('mp3'),
  sampleRate: z.number().default(22050),
  // 流式合成
  streamingEnabled: z.boolean().default(true),
  // 并发限制
  maxConcurrent: z.number().default(5),
  timeout: z.number().default(60000),
});

const voiceprintConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // 录入配置
  enrollmentSamplesRequired: z.number().min(3).max(10).default(5),
  enrollmentMinDuration: z.number().default(1000), // ms
  enrollmentMaxDuration: z.number().default(30000), // ms
  // 验证配置
  verificationThreshold: z.number().min(0).max(1).default(0.72),
  verificationMinDuration: z.number().default(500),
  // 特征配置
  featureType: z.enum(['mfcc', 'pitch', 'combined']).default('combined'),
  mfccCoefficients: z.number().default(13),
  // 存储配置
  storageType: z.enum(['database', 'file', 'memory']).default('database'),
  // 声纹库
  voiceprintDatabase: z.record(z.string(), z.object({
    userId: z.string(),
    enrolledAt: z.date(),
    lastVerified: z.date().optional(),
    sampleCount: z.number(),
    features: z.array(z.number()),
  })),
});

const continuousListeningConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // VAD配置
  vad: z.object({
    energyThreshold: z.number().min(0).max(1).default(0.02),
    silenceTimeout: z.number().min(500).max(10000).default(1500),
    speechMinDuration: z.number().min(100).max(2000).default(300),
    prerollDuration: z.number().default(200),
  }).default({}),
  // 音频配置
  audio: z.object({
    sampleRate: z.number().default(16000),
    channels: z.number().default(1),
    format: z.enum(['pcm16bit', 'float32']).default('pcm16bit'),
    bufferSize: z.number().default(4096),
  }).default({}),
  // 意图配置
  intent: z.object({
    confidenceThreshold: z.number().min(0).max(1).default(0.6),
    enableAIClassification: z.boolean().default(true),
    commandKeywords: z.array(z.string()).default([
      '帮我', '给我', '查询', '打开', '关闭', '播放', '暂停',
      '小智', 'xz', '智智'
    ]),
    meetingKeywords: z.array(z.string()).default([
      '会议', '讨论', '方案', '决策', '结论', '纪要',
      '汇报', '提案', '表决', '议程', '主持', '发言'
    ]),
    casualKeywords: z.array(z.string()).default([
      '天气', '吃饭', '回家', '睡觉', '今天', '昨天',
      '朋友', '家人', '孩子', '工作', '累', '困'
    ]),
  }).default({}),
  // 声纹配置
  voiceprintEnabled: z.boolean().default(true),
  requireMasterVerification: z.boolean().default(false),
  // 洞察配置
  insightEnabled: z.boolean().default(true),
  insightModes: z.array(z.enum(['MEETING', 'CONVERSATION', 'CASUAL', 'NEGOTIATION'])).default(['CONVERSATION']),
  // 存储配置
  retentionDays: z.number().min(1).max(90).default(10),
  // 性能配置
  maxSessionDuration: z.number().default(7200000), // 2小时
  autoRestartOnError: z.boolean().default(true),
  maxRestartAttempts: z.number().default(3),
});

const wakeWordConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // 唤醒词配置
  defaultWakeWords: z.array(z.string()).default(['小智', '小智小智', '智智', '嘿小智']),
  primaryWakeWord: z.string().default('小智'),
  // 灵敏度
  sensitivity: z.number().min(0).max(1).default(0.8),
  // 模糊匹配
  fuzzyMatchEnabled: z.boolean().default(true),
  fuzzyThreshold: z.number().min(0.5).max(1.0).default(0.7),
  // 用户配置存储
  userConfigs: z.record(z.string(), z.object({
    wakeWords: z.array(z.string()),
    primaryWakeWord: z.string(),
    sensitivity: z.number(),
  })).default({}),
});

const voiceCommandConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // 命令解析
  ruleBasedEnabled: z.boolean().default(true),
  aiBasedEnabled: z.boolean().default(true),
  aiModel: z.string().default('qwen-turbo'),
  aiTemperature: z.number().min(0).max(2).default(0.3),
  aiMaxTokens: z.number().default(500),
  aiTimeout: z.number().default(8000),
  // 置信度阈值
  ruleConfidenceThreshold: z.number().min(0).max(1).default(0.7),
  aiConfidenceThreshold: z.number().min(0).max(1).default(0.5),
  // 执行配置
  executionTimeout: z.number().default(30000),
  retryEnabled: z.boolean().default(true),
  maxRetries: z.number().default(2),
  // 需要确认的操作
  confirmRequiredActions: z.array(z.string()).default(['delete', 'remove', 'cancel']),
});

const mobileControlConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // WebSocket配置
  websocket: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().default(8765),
    path: z.string().default('/api/mobile/ws'),
    heartbeatInterval: z.number().default(30000),
    heartbeatTimeout: z.number().default(10000),
    maxConnections: z.number().default(100),
  }).default({}),
  // 设备配置
  device: z.object({
    secret: z.string().default('default-device-secret-change-in-production'),
    maxDevices: z.number().default(10),
    autoAuth: z.boolean().default(false),
  }).default({}),
  // 服务配置
  sms: z.object({
    enabled: z.boolean().default(true),
    maxPerDay: z.number().default(100),
  }).default({}),
  phone: z.object({
    enabled: z.boolean().default(true),
    requireConfirmation: z.boolean().default(true),
  }).default({}),
  file: z.object({
    enabled: z.boolean().default(true),
    maxFileSize: z.number().default(10485760), // 10MB
    allowedExtensions: z.array(z.string()).default(['pdf', 'doc', 'docx', 'txt', 'jpg', 'png']),
  }).default({}),
  // 视觉配置
  vision: z.object({
    enabled: z.boolean().default(true),
    screenshotQuality: z.number().min(50).max(100).default(80),
    captureInterval: z.number().default(5000),
  }).default({}),
});

const wechatConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // 文件监控
  fileWatchPaths: z.array(z.string()).default([
    '/tencent/MicroMsg/Download',
    '/tencent/MicroMsg/WeChat',
  ]),
  // 文件类型过滤
  fileTypes: z.object({
    document: z.array(z.string()).default(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']),
    image: z.array(z.string()).default(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']),
    video: z.array(z.string()).default(['mp4', 'avi', 'mov', 'wmv']),
    audio: z.array(z.string()).default(['mp3', 'wav', 'aac', 'm4a']),
  }).default({}),
  // 关键词检测
  keywords: z.object({
    lawyer: z.array(z.string()).default(['律师函', '律师', '起诉', '法院', '传票', '开庭']),
    contract: z.array(z.string()).default(['合同', '协议', '条款', '违约', '赔偿']),
    important: z.array(z.string()).default(['重要', '紧急', '立即', '必须']),
    financial: z.array(z.string()).default(['转账', '汇款', '支付', '收款', '账单']),
  }).default({}),
  // 自动处理
  autoProcess: z.object({
    enabled: z.boolean().default(true),
    ocrEnabled: z.boolean().default(true),
    classifyEnabled: z.boolean().default(true),
    alertEnabled: z.boolean().default(true),
  }).default({}),
  // 存储
  storage: z.object({
    retentionDays: z.number().default(30),
    maxStorageSize: z.number().default(1073741824), // 1GB
  }).default({}),
});

// ==================== 主配置类型 ====================

const voiceConfigSchema = z.object({
  asr: asrConfigSchema.default({}),
  tts: ttsConfigSchema.default({}),
  voiceprint: voiceprintConfigSchema.default({}),
  continuousListening: continuousListeningConfigSchema.default({}),
  wakeWord: wakeWordConfigSchema.default({}),
  voiceCommand: voiceCommandConfigSchema.default({}),
  mobileControl: mobileControlConfigSchema.default({}),
  wechat: wechatConfigSchema.default({}),
});

export type VoiceConfig = z.infer<typeof voiceConfigSchema>;
export type ASRConfig = z.infer<typeof asrConfigSchema>;
export type TTSConfig = z.infer<typeof ttsConfigSchema>;
export type VoiceprintConfig = z.infer<typeof voiceprintConfigSchema>;
export type ContinuousListeningConfig = z.infer<typeof continuousListeningConfigSchema>;
export type WakeWordConfig = z.infer<typeof wakeWordConfigSchema>;
export type VoiceCommandConfig = z.infer<typeof voiceCommandConfigSchema>;
export type MobileControlConfig = z.infer<typeof mobileControlConfigSchema>;
export type WeChatConfig = z.infer<typeof wechatConfigSchema>;

// ==================== 配置管理器 ====================

class VoiceConfigManager {
  private config: VoiceConfig | null = null;
  private initialized = false;

  /**
   * 初始化配置
   * 从环境变量和配置文件加载
   */
  initialize(): VoiceConfig {
    if (this.initialized && this.config) {
      return this.config;
    }

    try {
      // 基础配置
      const baseConfig = getBaseConfig();

      // 从环境变量构建语音配置
      const envConfig: Partial<VoiceConfig> = {
        asr: {
          enabled: process.env.VOICE_ASR_ENABLED !== 'false',
          provider: (process.env.VOICE_ASR_PROVIDER as 'dashscope' | 'whisper' | 'offline') || 'dashscope',
          model: process.env.VOICE_ASR_MODEL || 'paraformer-realtime-v2',
          language: (process.env.VOICE_ASR_LANGUAGE || 'zh,en').split(','),
          sampleRate: parseInt(process.env.VOICE_ASR_SAMPLE_RATE || '16000'),
          format: (process.env.VOICE_ASR_FORMAT as 'wav' | 'pcm' | 'mp3') || 'wav',
          realtimeEnabled: process.env.VOICE_ASR_REALTIME !== 'false',
          realtimeEndpoint: process.env.VOICE_ASR_REALTIME_ENDPOINT,
          fallbackEnabled: process.env.VOICE_ASR_FALLBACK !== 'false',
          fallbackProvider: (process.env.VOICE_ASR_FALLBACK_PROVIDER as 'whisper' | 'offline') || undefined,
          maxConcurrent: parseInt(process.env.VOICE_ASR_MAX_CONCURRENT || '10'),
          timeout: parseInt(process.env.VOICE_ASR_TIMEOUT || '30000'),
        },
        tts: {
          enabled: process.env.VOICE_TTS_ENABLED !== 'false',
          provider: (process.env.VOICE_TTS_PROVIDER as 'dashscope' | 'azure' | 'offline') || 'dashscope',
          model: process.env.VOICE_TTS_MODEL || 'cosyvoice-v3-flash',
          voice: process.env.VOICE_TTS_VOICE || 'longhuhu_v3',
          speed: parseFloat(process.env.VOICE_TTS_SPEED || '1.0'),
          pitch: parseFloat(process.env.VOICE_TTS_PITCH || '1.0'),
          volume: parseInt(process.env.VOICE_TTS_VOLUME || '50'),
          format: (process.env.VOICE_TTS_FORMAT as 'mp3' | 'wav' | 'pcm') || 'mp3',
          sampleRate: parseInt(process.env.VOICE_TTS_SAMPLE_RATE || '22050'),
          streamingEnabled: process.env.VOICE_TTS_STREAMING !== 'false',
          maxConcurrent: parseInt(process.env.VOICE_TTS_MAX_CONCURRENT || '5'),
          timeout: parseInt(process.env.VOICE_TTS_TIMEOUT || '60000'),
        },
        voiceprint: {
          enabled: process.env.VOICE_VOICEPRINT_ENABLED !== 'false',
          enrollmentSamplesRequired: parseInt(process.env.VOICE_VOICEPRINT_ENROLLMENT_SAMPLES || '5'),
          enrollmentMinDuration: parseInt(process.env.VOICE_VOICEPRINT_ENROLLMENT_MIN_DURATION || '1000'),
          enrollmentMaxDuration: parseInt(process.env.VOICE_VOICEPRINT_ENROLLMENT_MAX_DURATION || '30000'),
          verificationThreshold: parseFloat(process.env.VOICE_VOICEPRINT_THRESHOLD || '0.72'),
          verificationMinDuration: parseInt(process.env.VOICE_VOICEPRINT_VERIFICATION_DURATION || '500'),
          featureType: (process.env.VOICE_VOICEPRINT_FEATURE_TYPE as 'mfcc' | 'pitch' | 'combined') || 'combined',
          mfccCoefficients: parseInt(process.env.VOICE_VOICEPRINT_MFCC_COEFFICIENTS || '13'),
          storageType: (process.env.VOICE_VOICEPRINT_STORAGE as 'database' | 'file' | 'memory') || 'database',
          voiceprintDatabase: {},
        },
        continuousListening: {
          enabled: process.env.VOICE_CONTINUOUS_ENABLED !== 'false',
          vad: {
            energyThreshold: parseFloat(process.env.VOICE_VAD_THRESHOLD || '0.02'),
            silenceTimeout: parseInt(process.env.VOICE_VAD_SILENCE_TIMEOUT || '1500'),
            speechMinDuration: parseInt(process.env.VOICE_VAD_SPEECH_MIN_DURATION || '300'),
            prerollDuration: parseInt(process.env.VOICE_VAD_PREROLL_DURATION || '200'),
          },
          audio: {
            sampleRate: parseInt(process.env.VOICE_AUDIO_SAMPLE_RATE || '16000'),
            channels: parseInt(process.env.VOICE_AUDIO_CHANNELS || '1'),
            format: (process.env.VOICE_AUDIO_FORMAT as 'pcm16bit' | 'float32') || 'pcm16bit',
            bufferSize: parseInt(process.env.VOICE_AUDIO_BUFFER_SIZE || '4096'),
          },
          intent: {
            confidenceThreshold: parseFloat(process.env.VOICE_INTENT_THRESHOLD || '0.6'),
            enableAIClassification: process.env.VOICE_INTENT_AI !== 'false',
            commandKeywords: (process.env.VOICE_COMMAND_KEYWORDS || '帮我,给我,查询,打开,关闭').split(','),
            meetingKeywords: (process.env.VOICE_MEETING_KEYWORDS || '会议,讨论,方案,决策,结论').split(','),
            casualKeywords: (process.env.VOICE_CASUAL_KEYWORDS || '天气,吃饭,回家,睡觉,今天').split(','),
          },
          voiceprintEnabled: process.env.VOICE_CONTINUOUS_VOICEPRINT !== 'false',
          requireMasterVerification: process.env.VOICE_CONTINUOUS_REQUIRE_MASTER === 'true',
          insightEnabled: process.env.VOICE_CONTINUOUS_INSIGHT !== 'false',
          insightModes: (process.env.VOICE_INSIGHT_MODES || 'CONVERSATION').split(',') as unknown[],
          retentionDays: parseInt(process.env.VOICE_RETENTION_DAYS || '10'),
          maxSessionDuration: parseInt(process.env.VOICE_MAX_SESSION_DURATION || '7200000'),
          autoRestartOnError: process.env.VOICE_AUTO_RESTART !== 'false',
          maxRestartAttempts: parseInt(process.env.VOICE_MAX_RESTART_ATTEMPTS || '3'),
        },
        wakeWord: {
          enabled: process.env.VOICE_WAKEWORD_ENABLED !== 'false',
          defaultWakeWords: (process.env.VOICE_WAKEWORDS || '小智,小智小智,智智,嘿小智').split(','),
          primaryWakeWord: process.env.VOICE_PRIMARY_WAKEWORD || '小智',
          sensitivity: parseFloat(process.env.VOICE_WAKEWORD_SENSITIVITY || '0.8'),
          fuzzyMatchEnabled: process.env.VOICE_WAKEWORD_FUZZY !== 'false',
          fuzzyThreshold: parseFloat(process.env.VOICE_WAKEWORD_FUZZY_THRESHOLD || '0.7'),
          userConfigs: {},
        },
        voiceCommand: {
          enabled: process.env.VOICE_COMMAND_ENABLED !== 'false',
          ruleBasedEnabled: process.env.VOICE_COMMAND_RULE !== 'false',
          aiBasedEnabled: process.env.VOICE_COMMAND_AI !== 'false',
          aiModel: process.env.VOICE_COMMAND_AI_MODEL || 'qwen-turbo',
          aiTemperature: parseFloat(process.env.VOICE_COMMAND_AI_TEMPERATURE || '0.3'),
          aiMaxTokens: parseInt(process.env.VOICE_COMMAND_AI_MAX_TOKENS || '500'),
          aiTimeout: parseInt(process.env.VOICE_COMMAND_AI_TIMEOUT || '8000'),
          ruleConfidenceThreshold: parseFloat(process.env.VOICE_COMMAND_RULE_THRESHOLD || '0.7'),
          aiConfidenceThreshold: parseFloat(process.env.VOICE_COMMAND_AI_THRESHOLD || '0.5'),
          executionTimeout: parseInt(process.env.VOICE_COMMAND_EXECUTION_TIMEOUT || '30000'),
          retryEnabled: process.env.VOICE_COMMAND_RETRY !== 'false',
          maxRetries: parseInt(process.env.VOICE_COMMAND_MAX_RETRIES || '2'),
          confirmRequiredActions: (process.env.VOICE_COMMAND_CONFIRM_ACTIONS || 'delete,remove,cancel').split(','),
        },
        mobileControl: {
          enabled: process.env.MOBILE_CONTROL_ENABLED !== 'false',
          websocket: {
            host: process.env.MOBILE_WS_HOST || '0.0.0.0',
            port: parseInt(process.env.MOBILE_WS_PORT || '8765'),
            path: process.env.MOBILE_WS_PATH || '/api/mobile/ws',
            heartbeatInterval: parseInt(process.env.MOBILE_WS_HEARTBEAT_INTERVAL || '30000'),
            heartbeatTimeout: parseInt(process.env.MOBILE_WS_HEARTBEAT_TIMEOUT || '10000'),
            maxConnections: parseInt(process.env.MOBILE_WS_MAX_CONNECTIONS || '100'),
          },
          device: {
            secret: process.env.MOBILE_DEVICE_SECRET || 'default-device-secret-change-in-production',
            maxDevices: parseInt(process.env.MOBILE_MAX_DEVICES || '10'),
            autoAuth: process.env.MOBILE_AUTO_AUTH === 'true',
          },
          sms: {
            enabled: process.env.MOBILE_SMS_ENABLED !== 'false',
            maxPerDay: parseInt(process.env.MOBILE_SMS_MAX_PER_DAY || '100'),
          },
          phone: {
            enabled: process.env.MOBILE_PHONE_ENABLED !== 'false',
            requireConfirmation: process.env.MOBILE_PHONE_CONFIRM !== 'false',
          },
          file: {
            enabled: process.env.MOBILE_FILE_ENABLED !== 'false',
            maxFileSize: parseInt(process.env.MOBILE_FILE_MAX_SIZE || '10485760'),
            allowedExtensions: (process.env.MOBILE_FILE_EXTENSIONS || 'pdf,doc,docx,txt,jpg,png').split(','),
          },
          vision: {
            enabled: process.env.MOBILE_VISION_ENABLED !== 'false',
            screenshotQuality: parseInt(process.env.MOBILE_VISION_QUALITY || '80'),
            captureInterval: parseInt(process.env.MOBILE_VISION_CAPTURE_INTERVAL || '5000'),
          },
        },
        wechat: {
          enabled: process.env.WECHAT_ENABLED !== 'false',
          fileWatchPaths: (process.env.WECHAT_WATCH_PATHS || '/tencent/MicroMsg/Download,/tencent/MicroMsg/WeChat').split(','),
          fileTypes: {
            document: (process.env.WECHAT_FILE_TYPES_DOCUMENT || 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt').split(','),
            image: (process.env.WECHAT_FILE_TYPES_IMAGE || 'jpg,jpeg,png,gif,bmp,webp').split(','),
            video: (process.env.WECHAT_FILE_TYPES_VIDEO || 'mp4,avi,mov,wmv').split(','),
            audio: (process.env.WECHAT_FILE_TYPES_AUDIO || 'mp3,wav,aac,m4a').split(','),
          },
          keywords: {
            lawyer: (process.env.WECHAT_KEYWORDS_LAWYER || '律师函,律师,起诉,法院,传票,开庭').split(','),
            contract: (process.env.WECHAT_KEYWORDS_CONTRACT || '合同,协议,条款,违约,赔偿').split(','),
            important: (process.env.WECHAT_KEYWORDS_IMPORTANT || '重要,紧急,立即,必须').split(','),
            financial: (process.env.WECHAT_KEYWORDS_FINANCIAL || '转账,汇款,支付,收款,账单').split(','),
          },
          autoProcess: {
            enabled: process.env.WECHAT_AUTO_PROCESS !== 'false',
            ocrEnabled: process.env.WECHAT_AUTO_OCR !== 'false',
            classifyEnabled: process.env.WECHAT_AUTO_CLASSIFY !== 'false',
            alertEnabled: process.env.WECHAT_AUTO_ALERT !== 'false',
          },
          storage: {
            retentionDays: parseInt(process.env.WECHAT_STORAGE_RETENTION || '30'),
            maxStorageSize: parseInt(process.env.WECHAT_STORAGE_MAX_SIZE || '1073741824'),
          },
        },
      };

      // 验证配置
      this.config = voiceConfigSchema.parse(envConfig);
      this.initialized = true;

      log.info('语音配置初始化完成');
      this.logConfigSummary();

      return this.config;
    } catch (error) {
      console.error('[VoiceConfig] 配置初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): VoiceConfig {
    if (!this.config) {
      return this.initialize();
    }
    return this.config;
  }

  /**
   * 获取ASR配置
   */
  getASRConfig(): ASRConfig {
    return this.getConfig().asr;
  }

  /**
   * 获取TTS配置
   */
  getTTSConfig(): TTSConfig {
    return this.getConfig().tts;
  }

  /**
   * 获取声纹配置
   */
  getVoiceprintConfig(): VoiceprintConfig {
    return this.getConfig().voiceprint;
  }

  /**
   * 获取持续监听配置
   */
  getContinuousListeningConfig(): ContinuousListeningConfig {
    return this.getConfig().continuousListening;
  }

  /**
   * 获取唤醒词配置
   */
  getWakeWordConfig(): WakeWordConfig {
    return this.getConfig().wakeWord;
  }

  /**
   * 获取语音命令配置
   */
  getVoiceCommandConfig(): VoiceCommandConfig {
    return this.getConfig().voiceCommand;
  }

  /**
   * 获取移动控制配置
   */
  getMobileControlConfig(): MobileControlConfig {
    return this.getConfig().mobileControl;
  }

  /**
   * 获取微信配置
   */
  getWeChatConfig(): WeChatConfig {
    return this.getConfig().wechat;
  }

  /**
   * 更新用户唤醒词配置
   */
  updateUserWakeConfig(userId: string, config: Partial<WakeWordConfig>): void {
    if (!this.config) {
      this.initialize();
    }

    const currentConfig = this.config!.wakeWord.userConfigs[userId] || {
      wakeWords: this.config!.wakeWord.defaultWakeWords,
      primaryWakeWord: this.config!.wakeWord.primaryWakeWord,
      sensitivity: this.config!.wakeWord.sensitivity,
    };

    this.config!.wakeWord.userConfigs[userId] = {
      ...currentConfig,
      ...config,
    };
  }

  /**
   * 获取用户唤醒词配置
   */
  getUserWakeConfig(userId: string): WakeWordConfig | undefined {
    return this.getConfig().wakeWord.userConfigs[userId];
  }

  /**
   * 更新声纹数据库
   */
  updateVoiceprintDatabase(userId: string, data: VoiceprintConfig['voiceprintDatabase'][string]): void {
    if (!this.config) {
      this.initialize();
    }
    this.config!.voiceprint.voiceprintDatabase[userId] = data;
  }

  /**
   * 获取声纹数据
   */
  getVoiceprintData(userId: string): VoiceprintConfig['voiceprintDatabase'][string] | undefined {
    return this.getConfig().voiceprint.voiceprintDatabase[userId];
  }

  /**
   * 检查功能是否可用
   */
  isFeatureEnabled(feature: keyof VoiceConfig): boolean {
    const config = this.getConfig();
    return config[feature]?.enabled ?? false;
  }

  /**
   * 验证配置完整性
   */
  validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config = this.getConfig();

    // ASR检查
    if (config.asr.enabled && !process.env.DASHSCOPE_API_KEY) {
      warnings.push('ASR已启用但未配置DASHSCOPE_API_KEY');
    }

    // TTS检查
    if (config.tts.enabled && !process.env.DASHSCOPE_API_KEY) {
      warnings.push('TTS已启用但未配置DASHSCOPE_API_KEY');
    }

    // 声纹检查
    if (config.voiceprint.enabled && config.continuousListening.voiceprintEnabled) {
      const dbSize = Object.keys(config.voiceprint.voiceprintDatabase).length;
      if (dbSize === 0) {
        warnings.push('声纹识别已启用但声纹数据库为空');
      }
    }

    // 移动控制检查
    if (config.mobileControl.enabled && config.mobileControl.device.secret === 'default-device-secret-change-in-production') {
      warnings.push('移动控制使用了默认密钥，请修改MOBILE_DEVICE_SECRET');
    }

    // 持续监听检查
    if (config.continuousListening.enabled && !config.asr.enabled) {
      errors.push('持续监听已启用但ASR未启用');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 打印配置摘要
   */
  private logConfigSummary(): void {
    const config = this.getConfig();

    log.info({
      asr: `${config.asr.enabled ? '✓' : '✗'} (${config.asr.provider}/${config.asr.model})`,
      tts: `${config.tts.enabled ? '✓' : '✗'} (${config.tts.provider}/${config.tts.model}/${config.tts.voice})`,
      voiceprint: `${config.voiceprint.enabled ? '✓' : '✗'} (阈值:${config.voiceprint.verificationThreshold})`,
      continuousListening: `${config.continuousListening.enabled ? '✓' : '✗'}`,
      wakeWord: `${config.wakeWord.enabled ? '✓' : '✗'} (${config.wakeWord.defaultWakeWords.join(',')})`,
      mobileControl: `${config.mobileControl.enabled ? '✓' : '✗'} (端口:${config.mobileControl.websocket.port})`,
    }, '语音服务配置摘要');
  }

  /**
   * 重置配置
   */
  reset(): void {
    this.config = null;
    this.initialized = false;
  }
}

// 导出单例
export const voiceConfig = new VoiceConfigManager();

// 便捷函数
export const getVoiceConfig = () => voiceConfig.getConfig();
export const getASRConfig = () => voiceConfig.getASRConfig();
export const getTTSConfig = () => voiceConfig.getTTSConfig();
export const getVoiceprintConfig = () => voiceConfig.getVoiceprintConfig();
export const getContinuousListeningConfig = () => voiceConfig.getContinuousListeningConfig();
export const getWakeWordConfig = () => voiceConfig.getWakeWordConfig();
export const getVoiceCommandConfig = () => voiceConfig.getVoiceCommandConfig();
export const getMobileControlConfig = () => voiceConfig.getMobileControlConfig();
export const getWeChatConfig = () => voiceConfig.getWeChatConfig();
