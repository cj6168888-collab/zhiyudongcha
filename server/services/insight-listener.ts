/**
 * 智语洞察 (Insight Listener) - Z1 核心监听服务 v1.0
 * 
 * 智能场景识别 + 持续监听 + 隐蔽反馈系统
 * 作为会议、谈话、闲谈、谈判场景的关键入口
 * 
 * 功能层次：
 * 1. 手机端：VAD检测 + 声纹识别 + ASR转写 + 本地敏感过滤
 * 2. 服务端：实体提取 + 情绪分析 + 关系推理 + 场景识别
 * 3. 响应层：耳语提示 + 震动暗号 + 会后报告
 * 
 * 隐蔽反馈优先级：蓝牙耳机耳语 > 智能手表震动 > 手机静音震动
 * 录音保留：10天
 */

import { getDatabase } from '../db';
import { insightSessions, insightTranscripts, insightEntities, insightAlerts } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { taskClassifier } from './task-classifier';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('InsightListener');

export type ListeningMode = 'MEETING' | 'CONVERSATION' | 'CASUAL' | 'NEGOTIATION' | 'SILENT';

export type SceneSignal = {
  type: 'SPEAKER_COUNT' | 'FORMAL_LANGUAGE' | 'TOPIC_SHIFT' | 'SILENCE_PATTERN' | 'EMOTION_SPIKE';
  value: number;
  confidence: number;
};

export interface ListeningSession {
  id: string;
  userId: string;
  mode: ListeningMode;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  speakerCount: number;
  detectedScenes: SceneTransition[];
  transcriptCount: number;
  entityCount: number;
  alertCount: number;
}

export interface SceneTransition {
  fromMode: ListeningMode;
  toMode: ListeningMode;
  timestamp: Date;
  reason: string;
  confidence: number;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speakerId?: string;
  speakerName?: string;
  isMaster: boolean;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  emotion?: EmotionResult;
  keywords?: string[];
  sensitivityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface EmotionResult {
  primary: 'NEUTRAL' | 'HAPPY' | 'SAD' | 'ANGRY' | 'ANXIOUS' | 'EXCITED' | 'CONFUSED';
  confidence: number;
  intensity: number;
  indicators: string[];
}

export interface ExtractedEntity {
  id: string;
  sessionId: string;
  type: 'PERSON' | 'ORGANIZATION' | 'TOPIC' | 'COMMITMENT' | 'CONFLICT' | 'OPPORTUNITY' | 'DEADLINE' | 'MONEY';
  value: string;
  context: string;
  confidence: number;
  importance: number;
  relatedSpeaker?: string;
  timestamp: Date;
}

export interface InsightAlert {
  id: string;
  sessionId: string;
  type: 'OPPORTUNITY' | 'RISK' | 'COMMITMENT' | 'CONFLICT' | 'FOLLOWUP' | 'EMOTION_WARNING';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  suggestedAction?: string;
  relatedEntityIds?: string[];
  deliveredVia?: 'EARPHONE' | 'WATCH' | 'PHONE' | 'NONE';
  deliveredAt?: Date;
  acknowledged: boolean;
  createdAt: Date;
}

export interface FeedbackChannel {
  type: 'EARPHONE' | 'WATCH' | 'PHONE';
  available: boolean;
  deviceId?: string;
  priority: number;
}

export interface CovertFeedback {
  message: string;
  priority: InsightAlert['priority'];
  channels: FeedbackChannel[];
  hapticPattern?: number[];
  whisperText?: string;
}

const SCENE_RECOGNITION_PATTERNS: Record<ListeningMode, {
  keywords: RegExp[];
  speakerThreshold: { min: number; max: number };
  formalityScore: number;
  typicalDuration: { min: number; max: number };
}> = {
  MEETING: {
    keywords: [
      /会议|议程|汇报|总结|决议|行动项|下一步|各位|同事们/,
      /第一点|第二点|最后|综上|接下来|请.*发言/,
      /目标|进度|完成率|KPI|OKR|预算|资源/,
    ],
    speakerThreshold: { min: 3, max: 20 },
    formalityScore: 0.7,
    typicalDuration: { min: 15 * 60, max: 120 * 60 },
  },
  CONVERSATION: {
    keywords: [
      /你觉得|你怎么看|我想和你聊聊|谈一下|商量|请教/,
      /个人.*看法|建议|想法|意见|考虑/,
    ],
    speakerThreshold: { min: 2, max: 3 },
    formalityScore: 0.5,
    typicalDuration: { min: 5 * 60, max: 60 * 60 },
  },
  CASUAL: {
    keywords: [
      /哈哈|呵呵|最近怎么样|吃了吗|周末|假期|天气/,
      /八卦|听说|你知道吗|有意思|好玩/,
    ],
    speakerThreshold: { min: 2, max: 5 },
    formalityScore: 0.2,
    typicalDuration: { min: 1 * 60, max: 30 * 60 },
  },
  NEGOTIATION: {
    keywords: [
      /价格|条款|合同|条件|底线|让步|报价|成本|利润/,
      /合作|方案|协议|签约|交易|成交/,
      /如果.*那么|要是.*可以|前提是|除非/,
    ],
    speakerThreshold: { min: 2, max: 6 },
    formalityScore: 0.8,
    typicalDuration: { min: 20 * 60, max: 180 * 60 },
  },
  SILENT: {
    keywords: [],
    speakerThreshold: { min: 0, max: 0 },
    formalityScore: 0,
    typicalDuration: { min: 0, max: Infinity },
  },
};

const ENTITY_EXTRACTION_PATTERNS = {
  PERSON: [
    /(?:认识|见过|联系|找|问|请)[\s]*([张王李赵刘陈杨黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹易黎常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢骆岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳][^\s，。！？,.!?]{0,4}(?:先生|女士|总|经理|主任|老师|教授|博士|院长|老板|董事长|CEO)?)/,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/,
  ],
  ORGANIZATION: [
    /(?:公司|集团|机构|组织|部门|单位)[：:]\s*([^\s，。]+)/,
    /([\u4e00-\u9fa5]+(?:公司|集团|银行|保险|证券|基金|投资|控股|科技|网络|互联网|教育|医疗|地产|建筑|工程|贸易|咨询|律所|事务所))/,
  ],
  COMMITMENT: [
    /(?:我)?(?:保证|承诺|答应|一定|肯定会|必须要|负责)[^\n。]*([^\n。]{5,50})/,
    /(?:deadline|截止|最晚|务必在)[^\n。]*(\d{1,2}月\d{1,2}日|\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/,
  ],
  MONEY: [
    /(\d+(?:\.\d+)?(?:万|千|百)?[元块])/,
    /(\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:RMB|USD|CNY|美元|人民币))?)/,
    /([\d.]+%)/,
  ],
  DEADLINE: [
    /(?:截止|deadline|最晚|务必|不晚于|之前完成)[^\n]*?(\d{1,2}月\d{1,2}日|\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?|下?周[一二三四五六日天]|今天|明天|后天|本周|下周|月底|季度末|年底)/i,
  ],
  CONFLICT: [
    /(?:不同意|反对|有问题|不行|不可能|很难|矛盾|冲突|争议|分歧|质疑)[^\n。]*([^\n。]{10,80})/,
  ],
  OPPORTUNITY: [
    /(?:机会|可能|潜力|空间|值得|有意向|感兴趣|合作)[^\n。]*([^\n。]{10,60})/,
  ],
};

const EMOTION_KEYWORDS: Record<EmotionResult['primary'], RegExp[]> = {
  NEUTRAL: [],
  HAPPY: [/开心|高兴|太好了|棒|赞|厉害|不错|满意|感谢|谢谢/],
  SAD: [/遗憾|可惜|难过|失望|沮丧|糟糕|唉/],
  ANGRY: [/生气|愤怒|不满|过分|欺负|太过|凭什么|岂有此理/],
  ANXIOUS: [/担心|焦虑|紧张|着急|赶紧|来不及|怎么办|压力/],
  EXCITED: [/激动|兴奋|期待|迫不及待|太棒了|绝了|牛/],
  CONFUSED: [/不明白|疑惑|困惑|搞不懂|什么意思|为什么|怎么回事/],
};

class InsightListenerService {
  private activeSessions: Map<string, ListeningSession> = new Map();
  private feedbackChannels: Map<string, FeedbackChannel[]> = new Map();
  private sceneHistory: Map<string, SceneSignal[]> = new Map();
  
  private readonly RECORDING_RETENTION_DAYS = 10;

  async startSession(
    userId: string,
    initialMode?: ListeningMode
  ): Promise<ListeningSession> {
    const existingSession = Array.from(this.activeSessions.values())
      .find(s => s.userId === userId && s.isActive);
    
    if (existingSession) {
      logger.info(`[InsightListener] 用户 ${userId} 已有活跃会话: ${existingSession.id}`);
      return existingSession;
    }

    const sessionId = `insight-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const detectedMode = initialMode || 'SILENT';

    const session: ListeningSession = {
      id: sessionId,
      userId,
      mode: detectedMode,
      startTime: new Date(),
      isActive: true,
      speakerCount: 0,
      detectedScenes: [],
      transcriptCount: 0,
      entityCount: 0,
      alertCount: 0,
    };

    this.activeSessions.set(sessionId, session);
    this.sceneHistory.set(sessionId, []);

    try {
      await getDatabase().insert(insightSessions).values({
        id: sessionId,
        userId,
        mode: detectedMode,
        startTime: session.startTime,
        isActive: 1,
        speakerCount: 0,
      });
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 保存会话失败');
    }

    logger.info(`[InsightListener] 会话已启动: ${sessionId} (模式: ${detectedMode})`);
    return session;
  }

  async endSession(sessionId: string): Promise<ListeningSession | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    session.isActive = false;
    session.endTime = new Date();

    try {
      await getDatabase().update(insightSessions)
        .set({
          isActive: 0,
          endTime: session.endTime,
          transcriptCount: session.transcriptCount,
          entityCount: session.entityCount,
          alertCount: session.alertCount,
        })
        .where(eq(insightSessions.id, sessionId));
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 更新会话失败');
    }

    this.activeSessions.delete(sessionId);
    this.sceneHistory.delete(sessionId);

    logger.info(`[InsightListener] 会话已结束: ${sessionId}`);
    return session;
  }

  async processTranscript(
    sessionId: string,
    segment: Omit<TranscriptSegment, 'id' | 'sessionId' | 'emotion' | 'keywords' | 'sensitivityLevel'>
  ): Promise<{
    transcript: TranscriptSegment;
    entities: ExtractedEntity[];
    alerts: InsightAlert[];
    sceneChange?: SceneTransition;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`会话 ${sessionId} 不存在或已结束`);
    }

    const emotion = this.analyzeEmotion(segment.text);
    const keywords = this.extractKeywords(segment.text);
    const classification = taskClassifier.classify(segment.text, 'PRIVACY_FIRST');

    const transcript: TranscriptSegment = {
      id: `ts-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sessionId,
      ...segment,
      emotion,
      keywords,
      sensitivityLevel: classification.sensitivityLevel,
    };

    session.transcriptCount++;

    try {
      await getDatabase().insert(insightTranscripts).values({
        id: transcript.id,
        sessionId,
        speakerId: segment.speakerId,
        speakerName: segment.speakerName,
        isMaster: segment.isMaster ? 1 : 0,
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        confidence: segment.confidence,
        emotion: JSON.stringify(emotion),
        keywords,
        sensitivityLevel: transcript.sensitivityLevel,
      });
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 保存转写失败');
    }

    const entities = await this.extractEntities(sessionId, transcript);
    session.entityCount += entities.length;

    const alerts = await this.generateAlerts(sessionId, transcript, entities, emotion);
    session.alertCount += alerts.length;

    const sceneChange = await this.detectSceneChange(sessionId, transcript);
    if (sceneChange) {
      session.detectedScenes.push(sceneChange);
      session.mode = sceneChange.toMode;
    }

    for (const alert of alerts) {
      if (alert.priority === 'HIGH' || alert.priority === 'URGENT') {
        await this.deliverCovertFeedback(session.userId, {
          message: alert.title,
          priority: alert.priority,
          channels: this.feedbackChannels.get(session.userId) || [],
          whisperText: alert.suggestedAction || alert.description,
        });
      }
    }

    return { transcript, entities, alerts, sceneChange: sceneChange || undefined };
  }

  private analyzeEmotion(text: string): EmotionResult {
    let detectedEmotion: EmotionResult['primary'] = 'NEUTRAL';
    let maxScore = 0;
    const indicators: string[] = [];

    for (const [emotion, patterns] of Object.entries(EMOTION_KEYWORDS) as [EmotionResult['primary'], RegExp[]][]) {
      if (emotion === 'NEUTRAL') continue;
      
      let score = 0;
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length;
          indicators.push(...matches);
        }
      }

      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    }

    const exclamationCount = (text.match(/[!！]/g) || []).length;
    const questionCount = (text.match(/[?？]/g) || []).length;
    
    let intensity = Math.min(1, maxScore * 0.3 + exclamationCount * 0.1);

    return {
      primary: detectedEmotion,
      confidence: maxScore > 0 ? Math.min(0.95, 0.5 + maxScore * 0.15) : 0.3,
      intensity,
      indicators: indicators.slice(0, 5),
    };
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    
    const stopWords = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
    
    const words = text.split(/[\s，。！？、；：""''（）【】《》\n]+/).filter(w => 
      w.length >= 2 && w.length <= 10 && !stopWords.has(w)
    );

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    const sorted = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return sorted;
  }

  private async extractEntities(
    sessionId: string,
    transcript: TranscriptSegment
  ): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    const text = transcript.text;

    for (const [type, patterns] of Object.entries(ENTITY_EXTRACTION_PATTERNS) as [ExtractedEntity['type'], RegExp[]][]) {
      for (const pattern of patterns) {
        const matches = Array.from(text.matchAll(new RegExp(pattern, 'g')));
        for (const match of matches) {
          if (match[1] && match[1].trim()) {
            const entity: ExtractedEntity = {
              id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              sessionId,
              type,
              value: match[1].trim(),
              context: text.substring(Math.max(0, match.index! - 20), Math.min(text.length, match.index! + match[0].length + 20)),
              confidence: 0.75,
              importance: this.calculateEntityImportance(type, match[1]),
              relatedSpeaker: transcript.speakerName,
              timestamp: new Date(),
            };

            entities.push(entity);

            try {
              await getDatabase().insert(insightEntities).values({
                id: entity.id,
                sessionId,
                type: entity.type,
                value: entity.value,
                context: entity.context,
                confidence: entity.confidence,
                importance: entity.importance,
                relatedSpeaker: entity.relatedSpeaker,
              });
            } catch (error) {
              logger.error({ err: error }, '[InsightListener] 保存实体失败');
            }
          }
        }
      }
    }

    return entities;
  }

  private calculateEntityImportance(type: ExtractedEntity['type'], value: string): number {
    const baseImportance: Record<ExtractedEntity['type'], number> = {
      COMMITMENT: 0.9,
      CONFLICT: 0.85,
      OPPORTUNITY: 0.8,
      MONEY: 0.75,
      DEADLINE: 0.7,
      PERSON: 0.6,
      ORGANIZATION: 0.55,
      TOPIC: 0.5,
    };

    return baseImportance[type] || 0.5;
  }

  private async generateAlerts(
    sessionId: string,
    transcript: TranscriptSegment,
    entities: ExtractedEntity[],
    emotion: EmotionResult
  ): Promise<InsightAlert[]> {
    const alerts: InsightAlert[] = [];
    const now = new Date();

    for (const entity of entities) {
      if (entity.type === 'COMMITMENT' && entity.importance > 0.8) {
        alerts.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          sessionId,
          type: 'COMMITMENT',
          priority: transcript.isMaster ? 'MEDIUM' : 'HIGH',
          title: transcript.isMaster ? '您做出了承诺' : `${entity.relatedSpeaker || '对方'}做出了承诺`,
          description: entity.value,
          suggestedAction: '记录并跟进此承诺',
          relatedEntityIds: [entity.id],
          acknowledged: false,
          createdAt: now,
        });
      }

      if (entity.type === 'CONFLICT') {
        alerts.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          sessionId,
          type: 'CONFLICT',
          priority: 'HIGH',
          title: '检测到分歧点',
          description: entity.value,
          suggestedAction: '考虑换个角度或暂时搁置',
          relatedEntityIds: [entity.id],
          acknowledged: false,
          createdAt: now,
        });
      }

      if (entity.type === 'OPPORTUNITY') {
        alerts.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          sessionId,
          type: 'OPPORTUNITY',
          priority: 'MEDIUM',
          title: '发现潜在机会',
          description: entity.value,
          suggestedAction: '深入了解，寻找切入点',
          relatedEntityIds: [entity.id],
          acknowledged: false,
          createdAt: now,
        });
      }
    }

    if (emotion.primary === 'ANGRY' && emotion.intensity > 0.6 && !transcript.isMaster) {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sessionId,
        type: 'EMOTION_WARNING',
        priority: 'URGENT',
        title: '对方情绪激动',
        description: `检测到愤怒情绪 (强度: ${(emotion.intensity * 100).toFixed(0)}%)`,
        suggestedAction: '保持冷静，适当安抚，避免激化',
        acknowledged: false,
        createdAt: now,
      });
    }

    if (emotion.primary === 'ANXIOUS' && emotion.intensity > 0.5 && !transcript.isMaster) {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sessionId,
        type: 'EMOTION_WARNING',
        priority: 'MEDIUM',
        title: '对方表现出焦虑',
        description: `检测到焦虑情绪，可能是谈判突破口`,
        suggestedAction: '了解顾虑，提供保障方案',
        acknowledged: false,
        createdAt: now,
      });
    }

    for (const alert of alerts) {
      try {
        await getDatabase().insert(insightAlerts).values({
          id: alert.id,
          sessionId,
          type: alert.type,
          priority: alert.priority,
          title: alert.title,
          description: alert.description,
          suggestedAction: alert.suggestedAction,
          relatedEntityIds: alert.relatedEntityIds,
          acknowledged: 0,
        });
      } catch (error) {
        logger.error({ err: error }, '[InsightListener] 保存提醒失败');
      }
    }

    return alerts;
  }

  private async detectSceneChange(
    sessionId: string,
    transcript: TranscriptSegment
  ): Promise<SceneTransition | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const history = this.sceneHistory.get(sessionId) || [];
    const signals: SceneSignal[] = [];

    for (const [mode, config] of Object.entries(SCENE_RECOGNITION_PATTERNS) as [ListeningMode, typeof SCENE_RECOGNITION_PATTERNS.MEETING][]) {
      if (mode === 'SILENT') continue;

      let keywordScore = 0;
      for (const pattern of config.keywords) {
        if (pattern.test(transcript.text)) {
          keywordScore += 0.2;
        }
      }

      if (keywordScore > 0) {
        signals.push({
          type: 'FORMAL_LANGUAGE',
          value: mode === 'MEETING' ? 0.8 : mode === 'NEGOTIATION' ? 0.9 : mode === 'CONVERSATION' ? 0.5 : 0.2,
          confidence: Math.min(1, keywordScore),
        });
      }
    }

    history.push(...signals);
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    this.sceneHistory.set(sessionId, history);

    if (history.length < 5) return null;

    const recentSignals = history.slice(-10);
    const modeScores: Record<ListeningMode, number> = {
      MEETING: 0,
      CONVERSATION: 0,
      CASUAL: 0,
      NEGOTIATION: 0,
      SILENT: 0,
    };

    for (const signal of recentSignals) {
      if (signal.type === 'FORMAL_LANGUAGE') {
        if (signal.value > 0.7) {
          modeScores.MEETING += signal.confidence * 0.3;
          modeScores.NEGOTIATION += signal.confidence * 0.3;
        } else if (signal.value > 0.4) {
          modeScores.CONVERSATION += signal.confidence * 0.4;
        } else {
          modeScores.CASUAL += signal.confidence * 0.5;
        }
      }
    }

    let bestMode: ListeningMode = session.mode;
    let bestScore = 0;

    for (const [mode, score] of Object.entries(modeScores) as [ListeningMode, number][]) {
      if (score > bestScore && mode !== session.mode) {
        bestScore = score;
        bestMode = mode;
      }
    }

    if (bestScore > 0.5 && bestMode !== session.mode) {
      const transition: SceneTransition = {
        fromMode: session.mode,
        toMode: bestMode,
        timestamp: new Date(),
        reason: `检测到场景特征变化，置信度: ${(bestScore * 100).toFixed(0)}%`,
        confidence: bestScore,
      };

      logger.info(`[InsightListener] 场景切换: ${transition.fromMode} -> ${transition.toMode}`);

      try {
        await getDatabase().update(insightSessions)
          .set({ mode: bestMode })
          .where(eq(insightSessions.id, sessionId));
      } catch (error) {
        logger.error({ err: error }, '[InsightListener] 更新会话模式失败');
      }

      return transition;
    }

    return null;
  }

  registerFeedbackChannels(userId: string, channels: FeedbackChannel[]): void {
    const sorted = [...channels].sort((a, b) => a.priority - b.priority);
    this.feedbackChannels.set(userId, sorted);
    logger.info(`[InsightListener] 已注册反馈通道: ${userId} -> ${channels.map(c => c.type).join(', ')}`);
  }

  private async deliverCovertFeedback(userId: string, feedback: CovertFeedback): Promise<void> {
    const channels = this.feedbackChannels.get(userId) || [];
    const availableChannel = channels.find(c => c.available);

    if (!availableChannel) {
      logger.info(`[InsightListener] 无可用反馈通道: ${userId}`);
      return;
    }

    switch (availableChannel.type) {
      case 'EARPHONE':
        logger.info(`[InsightListener] 耳语反馈: "${feedback.whisperText || feedback.message}"`);
        break;
      case 'WATCH':
        const hapticPattern = this.getHapticPattern(feedback.priority);
        logger.info(`[InsightListener] 手表震动: ${hapticPattern.join('-')}`);
        break;
      case 'PHONE':
        logger.info(`[InsightListener] 手机震动: ${feedback.priority}`);
        break;
    }
  }

  private getHapticPattern(priority: InsightAlert['priority']): number[] {
    switch (priority) {
      case 'URGENT': return [200, 100, 200, 100, 200];
      case 'HIGH': return [300, 150, 300];
      case 'MEDIUM': return [200, 200];
      case 'LOW': return [100];
    }
  }

  async cleanupOldRecordings(): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RECORDING_RETENTION_DAYS);

    try {
      const oldSessions = await getDatabase().select({ id: insightSessions.id })
        .from(insightSessions)
        .where(lte(insightSessions.startTime, cutoffDate));

      if (oldSessions.length === 0) {
        return { deletedCount: 0 };
      }

      const sessionIds = oldSessions.map(s => s.id);

      for (const sessionId of sessionIds) {
        await getDatabase().delete(insightTranscripts).where(eq(insightTranscripts.sessionId, sessionId));
        await getDatabase().delete(insightEntities).where(eq(insightEntities.sessionId, sessionId));
        await getDatabase().delete(insightAlerts).where(eq(insightAlerts.sessionId, sessionId));
        await getDatabase().delete(insightSessions).where(eq(insightSessions.id, sessionId));
      }

      logger.info(`[InsightListener] 清理了 ${sessionIds.length} 个过期会话 (${this.RECORDING_RETENTION_DAYS}天前)`);
      return { deletedCount: sessionIds.length };
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 清理过期录音失败');
      return { deletedCount: 0 };
    }
  }

  async getSessionSummary(sessionId: string): Promise<{
    session: ListeningSession | null;
    topEntities: ExtractedEntity[];
    unacknowledgedAlerts: InsightAlert[];
    emotionalJourney: { time: Date; emotion: EmotionResult['primary']; speaker?: string }[];
    keyMoments: string[];
  } | null> {
    const session = this.activeSessions.get(sessionId);
    
    try {
      const entities = await getDatabase().select()
        .from(insightEntities)
        .where(eq(insightEntities.sessionId, sessionId))
        .orderBy(desc(insightEntities.importance))
        .limit(10);

      const alerts = await getDatabase().select()
        .from(insightAlerts)
        .where(and(
          eq(insightAlerts.sessionId, sessionId),
          eq(insightAlerts.acknowledged, 0)
        ));

      const transcripts = await getDatabase().select()
        .from(insightTranscripts)
        .where(eq(insightTranscripts.sessionId, sessionId))
        .orderBy(insightTranscripts.startTime);

      const emotionalJourney: { time: Date; emotion: EmotionResult['primary']; speaker?: string }[] = [];
      for (const t of transcripts) {
        if (!t.emotion) continue;
        try {
          const emotionData = typeof t.emotion === 'string' ? JSON.parse(t.emotion) as EmotionResult : null;
          if (emotionData && emotionData.primary !== 'NEUTRAL') {
            emotionalJourney.push({
              time: new Date(t.startTime),
              emotion: emotionData.primary,
              speaker: t.speakerName ?? undefined,
            });
          }
        } catch {
          continue;
        }
      }

      const keyMoments = (alerts as Array<{ type: string; title: string; description: string }>).map((a) => `[${a.type}] ${a.title}: ${a.description}`);

      return {
        session: session || null,
        topEntities: entities as unknown as ExtractedEntity[],
        unacknowledgedAlerts: alerts as unknown as InsightAlert[],
        emotionalJourney,
        keyMoments,
      };
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 获取会话总结失败');
      return null;
    }
  }

  getActiveSession(userId: string): ListeningSession | null {
    const sessions = Array.from(this.activeSessions.values());
    for (const session of sessions) {
      if (session.userId === userId && session.isActive) {
        return session;
      }
    }
    return null;
  }

  getAllActiveSessions(): ListeningSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.isActive);
  }

  async getSessionHistory(limit: number = 20, offset: number = 0): Promise<{
    id: string;
    userId: string;
    mode: string;
    startTime: Date;
    endTime: Date | null;
    isActive: boolean;
    transcriptCount: number;
    entityCount: number;
  }[]> {
    try {
      const sessions = await getDatabase().select()
        .from(insightSessions)
        .orderBy(desc(insightSessions.startTime))
        .limit(limit)
        .offset(offset);

      const results = [];
      for (const session of sessions) {
        const transcriptCountResult = await getDatabase().select({ count: sql<number>`count(*)` })
          .from(insightTranscripts)
          .where(eq(insightTranscripts.sessionId, session.id));
        
        const entityCountResult = await getDatabase().select({ count: sql<number>`count(*)` })
          .from(insightEntities)
          .where(eq(insightEntities.sessionId, session.id));

        results.push({
          id: session.id,
          userId: session.userId,
          mode: session.mode,
          startTime: session.startTime ? new Date(session.startTime) : new Date(),
          endTime: session.endTime ? new Date(session.endTime) : null,
          isActive: session.isActive ? true : false,
          transcriptCount: Number(transcriptCountResult[0]?.count || 0),
          entityCount: Number(entityCountResult[0]?.count || 0),
        });
      }

      return results;
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 获取历史会话失败');
      return [];
    }
  }

  async getSessionTranscripts(sessionId: string): Promise<{
    id: string;
    speakerName: string | null;
    isMaster: boolean;
    text: string;
    startTime: number;
    endTime: number;
    emotion: string | null;
    keywords: string[];
  }[]> {
    try {
      const transcripts = await getDatabase().select()
        .from(insightTranscripts)
        .where(eq(insightTranscripts.sessionId, sessionId))
        .orderBy(insightTranscripts.startTime);

      return transcripts.map(t => ({
        id: t.id,
        speakerName: t.speakerName,
        isMaster: t.isMaster ? true : false,
        text: t.text,
        startTime: typeof t.startTime === 'number' ? t.startTime : 0,
        endTime: typeof t.endTime === 'number' ? t.endTime : 0,
        emotion: (t.emotion as string | null) ?? null,
        keywords: t.keywords ? (Array.isArray(t.keywords) ? t.keywords as string[] : JSON.parse(t.keywords as string)) : [],
      }));
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 获取会话转写失败');
      return [];
    }
  }

  async getSessionEntities(sessionId: string): Promise<{
    id: string;
    type: string;
    value: string;
    context: string | null;
    confidence: number;
    importance: number;
    relatedSpeaker: string | null;
    linkedPersonId: string | null;
    linkedOrganizationId: string | null;
    createdAt: Date;
  }[]> {
    try {
      const entities = await getDatabase().select()
        .from(insightEntities)
        .where(eq(insightEntities.sessionId, sessionId))
        .orderBy(desc(insightEntities.createdAt));

      return entities.map(e => ({
        id: e.id,
        type: e.type,
        value: e.value,
        context: e.context,
        confidence: e.confidence ?? 0,
        importance: e.importance ?? 0.5,
        relatedSpeaker: e.relatedSpeaker,
        linkedPersonId: e.linkedPersonId,
        linkedOrganizationId: e.linkedOrganizationId,
        createdAt: e.createdAt ?? new Date(),
      }));
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 获取会话实体失败');
      return [];
    }
  }

  async adoptEntity(entityId: string, targetType: 'person' | 'project', storage: unknown): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    data?: unknown;
  }> {
    try {
      const entities = await getDatabase().select()
        .from(insightEntities)
        .where(eq(insightEntities.id, entityId))
        .limit(1);

      if (entities.length === 0) {
        return { success: false, error: '实体不存在' };
      }

      const entity = entities[0];

      if (targetType === 'person') {
        if (!['PERSON', 'ORGANIZATION'].includes(entity.type)) {
          return { success: false, error: `实体类型 ${entity.type} 不适合创建联系人` };
        }

        const newPerson = await storage.createPerson({
          name: entity.value,
          role: entity.relatedSpeaker || undefined,
          organization: entity.type === 'ORGANIZATION' ? entity.value : undefined,
          tags: ['从监听采纳'],
          addedBy: 'INSIGHT_LISTENER',
          notes: entity.context || undefined,
        });

        await getDatabase().update(insightEntities)
          .set({ linkedPersonId: newPerson.id })
          .where(eq(insightEntities.id, entityId));

        return {
          success: true,
          message: `已创建联系人: ${entity.value}`,
          data: newPerson,
        };
      } else if (targetType === 'project') {
        if (!['TOPIC', 'OPPORTUNITY', 'COMMITMENT'].includes(entity.type)) {
          return { success: false, error: `实体类型 ${entity.type} 不适合创建项目` };
        }

        const newProject = await storage.createProject({
          title: entity.value,
          description: entity.context || `从智语洞察采纳的${entity.type === 'OPPORTUNITY' ? '商机' : entity.type === 'COMMITMENT' ? '承诺' : '话题'}`,
          category: entity.type === 'OPPORTUNITY' ? 'BUSINESS' : 'GENERAL',
          status: 'PENDING_REVIEW',
          priority: Math.round((entity.importance ?? 0.5) * 10),
        });

        return {
          success: true,
          message: `已创建项目: ${entity.value}`,
          data: newProject,
        };
      }

      return { success: false, error: '不支持的目标类型' };
    } catch (error) {
      logger.error({ err: error }, '[InsightListener] 采纳实体失败');
      return { success: false, error: '采纳实体时发生错误' };
    }
  }

  getStats(): {
    activeSessions: number;
    totalTranscripts: number;
    totalEntities: number;
    totalAlerts: number;
    modeDistribution: Record<ListeningMode, number>;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const modeDistribution: Record<ListeningMode, number> = {
      MEETING: 0,
      CONVERSATION: 0,
      CASUAL: 0,
      NEGOTIATION: 0,
      SILENT: 0,
    };

    let totalTranscripts = 0;
    let totalEntities = 0;
    let totalAlerts = 0;

    for (const session of sessions) {
      modeDistribution[session.mode]++;
      totalTranscripts += session.transcriptCount;
      totalEntities += session.entityCount;
      totalAlerts += session.alertCount;
    }

    return {
      activeSessions: sessions.filter(s => s.isActive).length,
      totalTranscripts,
      totalEntities,
      totalAlerts,
      modeDistribution,
    };
  }
}

export const insightListenerService = new InsightListenerService();
export default InsightListenerService;

logger.info('[InsightListener] 智语洞察服务 v1.0 已初始化');
logger.info('[InsightListener] 支持模式: MEETING, CONVERSATION, CASUAL, NEGOTIATION, SILENT');
logger.info('[InsightListener] 录音保留期限: 10天');
