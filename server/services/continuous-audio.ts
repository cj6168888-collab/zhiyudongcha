/**
 * 免唤醒持续监听服务 - ContinuousAudioService
 * 
 * 功能：
 * 1. 接收Android端持续音频流
 * 2. VAD语音活动检测（区分人声/静音/噪音）
 * 3. 声纹识别（判断是否为主人）
 * 4. ASR语音转写
 * 5. 意图分类（命令小智 vs 闲聊 vs 会议谈话）
 * 6. 对接智语洞察服务
 */

import { EventEmitter } from 'events';
import { createServiceLogger } from '../lib/logger';
import { detectWakeWord } from './wake-word';
import { insightListenerService } from './insight-listener';
import { parseVoiceCommandWithAI, executeVoiceCommandWithAI } from './voice-commander';
import { verifyVoiceprint, enrollVoiceprint } from './voiceprint';
import type { IStorage } from '../storage';

const logger = createServiceLogger('ContinuousAudio');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const ASR_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/audio/asrtranscription';

export type AudioSource = 'MOBILE' | 'GLASSES' | 'PC' | 'UNKNOWN';

export type IntentType = 
  | 'VOICE_COMMAND'   // 命令小智
  | 'CONVERSATION'    // 闲聊对话
  | 'MEETING'         // 会议/正式谈话
  | 'CASUAL'          // 日常闲谈
  | 'SILENCE'         // 静音/噪音
  | 'UNKNOWN';        // 无法判断

export interface AudioSegment {
  sessionId: string;
  deviceId: string;
  source: AudioSource;
  audio: Buffer;
  timestamp: number;
  duration: number;
}

export interface IntentResult {
  type: IntentType;
  confidence: number;
  text?: string;
  action?: string;
  needsResponse: boolean;
  shouldRecord: boolean;
  masterSpeaking: boolean;
}

export interface ContinuousSession {
  id: string;
  userId: string;
  deviceId: string;
  source: AudioSource;
  startTime: number;
  isActive: boolean;
  masterVoiceEnrolled: boolean;
  totalAudioProcessed: number;
  commandCount: number;
  conversationCount: number;
  insightSessionId?: string;
}

class ContinuousAudioService extends EventEmitter {
  private sessions: Map<string, ContinuousSession> = new Map();
  private audioBuffer: Map<string, Buffer[]> = new Map();
  private vadState: Map<string, 'IDLE' | 'SPEECH' | 'SILENCE'> = new Map();
  
  private readonly VAD_THRESHOLD = 0.02;
  private readonly MIN_SPEECH_DURATION = 300; // ms
  private readonly MAX_SILENCE_DURATION = 2000; // ms
  private readonly SPEECH_BUFFER_SIZE = 4096;
  
  private readonly INTENT_CONFIDENCE_THRESHOLD = 0.6;
  
  constructor() {
    super();
    logger.info('ContinuousAudioService 初始化完成 - 免唤醒持续监听');
  }

  /**
   * 创建持续监听会话
   */
  async createSession(
    userId: string,
    deviceId: string,
    source: AudioSource = 'MOBILE'
  ): Promise<ContinuousSession> {
    const sessionId = `cont-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const session: ContinuousSession = {
      id: sessionId,
      userId,
      deviceId,
      source,
      startTime: Date.now(),
      isActive: true,
      masterVoiceEnrolled: false,
      totalAudioProcessed: 0,
      commandCount: 0,
      conversationCount: 0,
    };
    
    this.sessions.set(sessionId, session);
    this.audioBuffer.set(sessionId, []);
    this.vadState.set(sessionId, 'IDLE');
    
    // 检查是否已录入主人声纹
    session.masterVoiceEnrolled = await this.checkMasterVoiceEnrolled(userId);
    
    // 启动智语洞察会话
    if (source === 'MOBILE') {
      try {
        const insightSession = await insightListenerService.startSession(userId, 'CONVERSATION');
        session.insightSessionId = insightSession.id;
        logger.info({ sessionId, insightSessionId: insightSession.id }, '智语洞察会话已启动');
      } catch (error) {
        logger.error({ err: error }, '启动洞察会话失败');
      }
    }
    
    logger.info({ sessionId, userId, deviceId, source }, '持续监听会话已创建');
    
    return session;
  }

  /**
   * 结束持续监听会话
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.isActive = false;
    
    // 结束智语洞察会话
    if (session.insightSessionId) {
      try {
        await insightListenerService.endSession(session.insightSessionId);
      } catch (error) {
        logger.error({ err: error }, '结束洞察会话失败');
      }
    }
    
    this.sessions.delete(sessionId);
    this.audioBuffer.delete(sessionId);
    this.vadState.delete(sessionId);
    
    logger.info({ sessionId }, '持续监听会话已结束');
  }

  /**
   * 处理音频数据
   */
  async processAudio(sessionId: string, audioData: Buffer): Promise<IntentResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return null;
    }
    
    session.totalAudioProcessed++;
    
    // 1. VAD检测 - 判断是否有语音
    const hasSpeech = this.detectSpeech(audioData);
    const vadState = this.vadState.get(sessionId) || 'IDLE';
    
    if (hasSpeech) {
      // 有语音，更新状态
      if (vadState === 'IDLE' || vadState === 'SILENCE') {
        this.vadState.set(sessionId, 'SPEECH');
        this.audioBuffer.set(sessionId, [audioData]);
        logger.debug({ sessionId }, '检测到语音开始');
      } else {
        // 继续录音
        const buffer = this.audioBuffer.get(sessionId) || [];
        buffer.push(audioData);
        this.audioBuffer.set(sessionId, buffer);
      }
    } else {
      // 无语音
      if (vadState === 'SPEECH') {
        // 语音结束，处理完整音频
        const audioBuffer = this.audioBuffer.get(sessionId) || [];
        this.audioBuffer.set(sessionId, []);
        this.vadState.set(sessionId, 'SILENCE');
        
        if (audioBuffer.length > 0) {
          const fullAudio = Buffer.concat(audioBuffer);
          const duration = fullAudio.length / 16000 / 2; // 估算时长
          
          if (duration > 0.3) {
            // 2. 声纹识别 - 判断是否为主人
            const masterResult = await this.identifySpeaker(session, fullAudio);
            
            // 3. ASR转写
            const text = await this.transcribeAudio(fullAudio);
            
            if (text) {
              // 4. 意图分类
              const intent = await this.classifyIntent(text, masterResult.isMaster);
              
              logger.info({
                sessionId,
                text: text.substring(0, 50),
                intent: intent.type,
                master: masterResult.isMaster
              }, '音频处理结果');
              
              // 5. 执行相应动作
              await this.handleIntent(session, text, intent, fullAudio);
              
              return intent;
            }
          }
        }
      }
      
      // 保持静音状态一段时间后重置
      this.vadState.set(sessionId, 'SILENCE');
    }
    
    return null;
  }

  /**
   * VAD语音检测
   */
  private detectSpeech(audioData: Buffer): boolean {
    // 简化的能量检测
    const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
    let sum = 0;
    
    for (let i = 0; i < samples.length; i++) {
      sum += Math.abs(samples[i]);
    }
    
    const energy = sum / samples.length / 32768;
    return energy > this.VAD_THRESHOLD;
  }

  /**
   * 声纹识别
   */
  private async identifySpeaker(session: ContinuousSession, audio: Buffer): Promise<{
    isMaster: boolean;
    confidence: number;
  }> {
    // 检查是否已录入声纹
    if (!session.masterVoiceEnrolled) {
      return { isMaster: false, confidence: 0 };
    }
    
    try {
      // 简化的声纹验证调用
      // 实际应使用voiceprint服务的verifyVoiceprint函数
      const result = await verifyVoiceprint(audio, session.userId);
      return {
        isMaster: result.isMatch,
        confidence: result.confidence
      };
    } catch (error) {
      logger.error({ err: error }, '声纹识别失败');
      return { isMaster: false, confidence: 0 };
    }
  }

  /**
   * 检查主人声纹是否已录入
   */
  private async checkMasterVoiceEnrolled(userId: string): Promise<boolean> {
    // 实际应查询声纹数据库
    // 这里简化处理
    return true;
  }

  /**
   * ASR语音转写
   */
  private async transcribeAudio(audio: Buffer): Promise<string | null> {
    if (!DASHSCOPE_API_KEY) {
      logger.warn('未配置DASHSCOPE_API_KEY');
      return null;
    }
    
    try {
      // 使用阿里云ASR服务
      // 这里简化处理，实际应建立WebSocket连接
      const base64 = audio.toString('base64');
      
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'paraformer-realtime-v2',
          input: {
            audio: base64,
          },
          parameters: {
            format: 'wav',
            sample_rate: 16000,
            language_hints: ['zh', 'en'],
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`ASR请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      return data.output?.text || null;
      
    } catch (error) {
      logger.error({ err: error }, 'ASR转写失败');
      return null;
    }
  }

  /**
   * 意图分类
   */
  private async classifyIntent(text: string, isMaster: boolean): Promise<IntentResult> {
    const trimmedText = text.trim().toLowerCase();
    
    // 1. 检查是否是命令小智（唤醒词检测）
    const wakeWordResult = detectWakeWord(text, 'default');
    if (wakeWordResult.detected) {
      return {
        type: 'VOICE_COMMAND',
        confidence: wakeWordResult.confidence,
        text: wakeWordResult.remainingText,
        needsResponse: true,
        shouldRecord: false,
        masterSpeaking: isMaster,
      };
    }
    
    // 2. 检查是否是直接命令（无唤醒词，但明确在命令小智）
    const commandPatterns = [
      /^帮?我?[把]?(.+)/i,           // 帮我xxx
      /^给?我?(.+)/i,                  // 给我xxx
      /^查询?(.+)/i,                   // 查询xxx
      /^打开?(.+)/i,                   // 打开xxx
      /^关闭?(.+)/i,                   // 关闭xxx
      /^播放?(.+)/i,                   // 播放xxx
      /^暂停?(.+)/i,                   // 暂停
      /^(小智|xz|智智)[，,]?(.+)/i,   // 小智xxx
    ];
    
    for (const pattern of commandPatterns) {
      const match = trimmedText.match(pattern);
      if (match) {
        return {
          type: 'VOICE_COMMAND',
          confidence: 0.8,
          text: match[1] || match[0],
          needsResponse: true,
          shouldRecord: false,
          masterSpeaking: isMaster,
        };
      }
    }
    
    // 3. 会议/正式谈话关键词
    const meetingKeywords = [
      '会议', '讨论', '方案', '决策', '结论', '纪要',
      '汇报', '提案', '表决', '议程', '主持', '发言',
    ];
    
    const casualKeywords = [
      '天气', '吃饭', '回家', '睡觉', '今天', '昨天',
      '朋友', '家人', '孩子', '工作', '累', '困',
    ];
    
    const hasMeetingKeyword = meetingKeywords.some(k => trimmedText.includes(k));
    const hasCasualKeyword = casualKeywords.some(k => trimmedText.includes(k));
    
    // 4. AI意图分类（当规则无法判断时）
    if (!hasMeetingKeyword && !hasCasualKeyword) {
      try {
        const aiIntent = await this.aiClassifyIntent(text, isMaster);
        return aiIntent;
      } catch (error) {
        logger.error({ err: error }, 'AI意图分类失败');
      }
    }
    
    // 5. 根据关键词和上下文判断
    if (hasMeetingKeyword) {
      return {
        type: 'MEETING',
        confidence: 0.7,
        text,
        needsResponse: false,
        shouldRecord: true,
        masterSpeaking: isMaster,
      };
    }
    
    if (hasCasualKeyword || !isMaster) {
      return {
        type: 'CASUAL',
        confidence: 0.6,
        text,
        needsResponse: false,
        shouldRecord: true,
        masterSpeaking: isMaster,
      };
    }
    
    return {
      type: 'CONVERSATION',
      confidence: 0.5,
      text,
      needsResponse: false,
      shouldRecord: true,
      masterSpeaking: isMaster,
    };
  }

  /**
   * AI意图分类
   */
  private async aiClassifyIntent(text: string, isMaster: boolean): Promise<IntentResult> {
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            {
              role: 'system',
              content: `分析以下语音内容，判断用户意图。返回JSON：
{
  "intent": "COMMAND"|"CONVERSATION"|"MEETING"|"CASUAL"|"UNKNOWN",
  "confidence": 0.0-1.0,
  "reason": "判断理由",
  "shouldRespond": true/false,
  "shouldRecord": true/false
}

判断规则：
- COMMAND: 明确在命令AI助手做事（帮我xxx、打开xxx、查询xxx）
- MEETING: 正式会议讨论，涉及决策、方案、结论等
- CONVERSATION: 与AI的日常对话
- CASUAL: 日常闲谈，聊天八卦
- UNKNOWN: 无法判断

注意：即使没有唤醒词，也可能是在命令小智做事。`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      
      // 解析JSON
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        
        const intentMap: Record<string, IntentType> = {
          'COMMAND': 'VOICE_COMMAND',
          'CONVERSATION': 'CONVERSATION',
          'MEETING': 'MEETING',
          'CASUAL': 'CASUAL',
          'UNKNOWN': 'UNKNOWN',
        };
        
        return {
          type: intentMap[parsed.intent] || 'UNKNOWN',
          confidence: parsed.confidence || 0.5,
          text,
          needsResponse: parsed.shouldRespond || false,
          shouldRecord: parsed.shouldRecord || true,
          masterSpeaking: isMaster,
        };
      }
    } catch (error) {
      logger.error({ err: error }, 'AI意图分类请求失败');
    }
    
    return {
      type: 'UNKNOWN',
      confidence: 0,
      text,
      needsResponse: false,
      shouldRecord: true,
      masterSpeaking: isMaster,
    };
  }

  /**
   * 处理识别到的意图
   */
  private async handleIntent(
    session: ContinuousSession,
    text: string,
    intent: IntentResult,
    audio: Buffer
  ): Promise<void> {
    // 1. 如果是命令，执行命令
    if (intent.type === 'VOICE_COMMAND' && intent.text) {
      session.commandCount++;
      
      logger.info({ sessionId: session.id, command: intent.text }, '语音命令');
      
      // 这里应该调用voice-commander执行命令
      // 需要传入storage实例
      try {
        // 简化的命令执行
        this.emit('voiceCommand', {
          sessionId: session.id,
          userId: session.userId,
          command: intent.text,
          text,
        });
      } catch (error) {
        logger.error({ err: error }, '执行语音命令失败');
      }
    }
    
    // 2. 如果需要记录，发送到智语洞察
    if (intent.shouldRecord && session.insightSessionId) {
      session.conversationCount++;
      
      try {
        await insightListenerService.processTranscript(session.insightSessionId, {
          speakerId: intent.masterSpeaking ? 'master' : 'other',
          speakerName: intent.masterSpeaking ? '主人' : '对方',
          isMaster: intent.masterSpeaking,
          text,
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          confidence: intent.confidence,
        });
        
        logger.debug({ sessionId: session.id, text: text.substring(0, 30) }, '已发送到洞察服务');
      } catch (error) {
        logger.error({ err: error }, '发送到洞察服务失败');
      }
    }
    
    // 3. 发出事件供其他模块使用
    this.emit('audioProcessed', {
      sessionId: session.id,
      userId: session.userId,
      intent,
      text,
    });
  }

  /**
   * 获取会话统计
   */
  getSessionStats(sessionId: string): ContinuousSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): ContinuousSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  /**
   * 更新主人声纹状态
   */
  async updateMasterVoiceStatus(userId: string, enrolled: boolean): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.masterVoiceEnrolled = enrolled;
      }
    }
    logger.info({ userId, enrolled }, '主人声纹状态已更新');
  }
}

export const continuousAudioService = new ContinuousAudioService();
export default continuousAudioService;
