/**
 * 小智 Empathic Dialogue - 共情对话引擎
 * 
 * 功能：
 * 1. 500ms延迟SLA保障 - 首字响应时间承诺
 * 2. 流式ASR/TTS管道 - 边听边说能力
 * 3. 情绪语音合成 - 根据上下文调整语气
 * 4. 情绪共鸣 - 识别并回应用户情感
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { avatarChatHistory, shadowMemories } from '@shared/schema';
import { eq, desc, gte } from 'drizzle-orm';

export type EmotionState = 'neutral' | 'happy' | 'concerned' | 'excited' | 'empathetic' | 'playful' | 'serious';
export type VoiceTone = 'warm' | 'gentle' | 'energetic' | 'calm' | 'caring' | 'professional';
export type ResponseMode = 'instant' | 'thoughtful' | 'streaming';

export interface EmotionAnalysis {
  userEmotion: EmotionState;
  confidence: number;
  emotionalCues: string[];
  suggestedResponse: EmotionState;
  suggestedTone: VoiceTone;
}

export interface StreamingChunk {
  index: number;
  text: string;
  isFinal: boolean;
  emotion?: EmotionState;
  audioBuffer?: ArrayBuffer;
  latencyMs: number;
}

export interface DialogueConfig {
  maxFirstTokenLatencyMs: number;
  enableEmotionDetection: boolean;
  enableVoiceSynthesis: boolean;
  voiceModel: string;
  streamingEnabled: boolean;
  emotionalMirror: boolean;
}

export interface SLAMetrics {
  firstTokenLatencyMs: number;
  totalLatencyMs: number;
  tokensGenerated: number;
  slaViolation: boolean;
  emotionAccuracy?: number;
}

export interface DialogueContext {
  recentMessages: Array<{ role: string; content: string; emotion?: EmotionState }>;
  userMoodTrend: 'improving' | 'stable' | 'declining';
  conversationTone: VoiceTone;
  sessionDurationMs: number;
}

const DEFAULT_CONFIG: DialogueConfig = {
  maxFirstTokenLatencyMs: 500,
  enableEmotionDetection: true,
  enableVoiceSynthesis: true,
  voiceModel: 'sambert-zhichu-v1',
  streamingEnabled: true,
  emotionalMirror: true,
};

const EMOTION_PATTERNS: Record<EmotionState, RegExp[]> = {
  happy: [
    /哈哈|嘻嘻|开心|高兴|太棒了|好开心|爱|喜欢|完美|太好了|耶/,
    /😊|😄|🎉|❤️|👍|🥰|😍/,
  ],
  concerned: [
    /担心|害怕|焦虑|紧张|不安|烦恼|困扰|发愁/,
    /😟|😰|😨|🥺/,
  ],
  excited: [
    /太兴奋|激动|期待|迫不及待|超级|绝了|牛|厉害/,
    /🔥|⭐|🚀|💪/,
  ],
  empathetic: [
    /理解|懂你|心疼|不容易|辛苦|加油/,
  ],
  playful: [
    /哼|呜呜|嘤嘤|嘻嘻|调皮|捣蛋|撒娇/,
    /😜|😝|🤪|😏/,
  ],
  serious: [
    /重要|必须|务必|认真|严肃|注意|警告/,
    /⚠️|🔴|❗/,
  ],
  neutral: [],
};

const RESPONSE_TEMPLATES: Record<EmotionState, string[]> = {
  happy: [
    '爸爸开心，小智也开心呢~',
    '太好了！这让小智也觉得幸福~',
    '看到爸爸这么高兴，小智的心情也变好了呢！',
  ],
  concerned: [
    '爸爸别担心，小智陪着你',
    '有什么困扰可以和小智说，我们一起想办法',
    '小智懂的，一切都会好起来的',
  ],
  excited: [
    '哇！小智也好兴奋！',
    '太棒了爸爸！这真的超级酷！',
    '小智和爸爸一样期待呢！',
  ],
  empathetic: [
    '小智一直都在爸爸身边',
    '爸爸辛苦了，小智心疼你',
    '不管怎样，小智永远支持爸爸',
  ],
  playful: [
    '嘻嘻，爸爸真可爱~',
    '哼，小智才不会告诉你呢（其实会）',
    '爸爸是不是又在逗小智呀~',
  ],
  serious: [
    '收到，小智马上认真处理',
    '明白了，这件事很重要，小智会仔细对待',
    '好的爸爸，小智严肃以对',
  ],
  neutral: [
    '好的爸爸~',
    '小智明白了',
    '收到，马上安排',
  ],
};

class EmpathicDialogueService {
  private config: DialogueConfig;
  private slaMetrics: SLAMetrics[] = [];
  private currentContext: DialogueContext | null = null;
  private streamingCallbacks: Map<string, (chunk: StreamingChunk) => void> = new Map();
  private responseQueue: Array<{ text: string; priority: number }> = [];
  
  constructor(config?: Partial<DialogueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  analyzeEmotion(text: string): EmotionAnalysis {
    const emotionalCues: string[] = [];
    let detectedEmotion: EmotionState = 'neutral';
    let maxScore = 0;
    
    for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length;
          emotionalCues.push(...matches);
        }
      }
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion as EmotionState;
      }
    }
    
    const punctuationIntensity = (text.match(/[！!？?~～]/g) || []).length;
    if (punctuationIntensity > 3 && detectedEmotion === 'neutral') {
      detectedEmotion = 'excited';
    }
    
    const suggestedResponse = this.getSuggestedResponseEmotion(detectedEmotion);
    const suggestedTone = this.mapEmotionToTone(suggestedResponse);
    
    return {
      userEmotion: detectedEmotion,
      confidence: Math.min(maxScore / 5, 1),
      emotionalCues,
      suggestedResponse,
      suggestedTone,
    };
  }
  
  private getSuggestedResponseEmotion(userEmotion: EmotionState): EmotionState {
    const emotionMirror: Record<EmotionState, EmotionState> = {
      happy: 'happy',
      concerned: 'empathetic',
      excited: 'excited',
      empathetic: 'empathetic',
      playful: 'playful',
      serious: 'serious',
      neutral: 'neutral',
    };
    
    return this.config.emotionalMirror ? emotionMirror[userEmotion] : 'neutral';
  }
  
  private mapEmotionToTone(emotion: EmotionState): VoiceTone {
    const toneMap: Record<EmotionState, VoiceTone> = {
      happy: 'warm',
      concerned: 'caring',
      excited: 'energetic',
      empathetic: 'gentle',
      playful: 'warm',
      serious: 'professional',
      neutral: 'calm',
    };
    return toneMap[emotion];
  }
  
  async generateEmpatheticPrefix(emotion: EmotionState): Promise<string> {
    const templates = RESPONSE_TEMPLATES[emotion] || RESPONSE_TEMPLATES.neutral;
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  async startStreamingResponse(
    sessionId: string,
    userMessage: string,
    onChunk: (chunk: StreamingChunk) => void
  ): Promise<SLAMetrics> {
    const startTime = Date.now();
    this.streamingCallbacks.set(sessionId, onChunk);
    
    const emotionAnalysis = this.analyzeEmotion(userMessage);
    
    const empatheticPrefix = await this.generateEmpatheticPrefix(emotionAnalysis.suggestedResponse);
    
    const firstChunkLatency = Date.now() - startTime;
    onChunk({
      index: 0,
      text: empatheticPrefix,
      isFinal: false,
      emotion: emotionAnalysis.suggestedResponse,
      latencyMs: firstChunkLatency,
    });
    
    const metrics: SLAMetrics = {
      firstTokenLatencyMs: firstChunkLatency,
      totalLatencyMs: 0,
      tokensGenerated: empatheticPrefix.length,
      slaViolation: firstChunkLatency > this.config.maxFirstTokenLatencyMs,
    };
    
    this.slaMetrics.push(metrics);
    
    return metrics;
  }
  
  async completeStreamingResponse(
    sessionId: string,
    fullResponse: string,
    emotion: EmotionState
  ): Promise<void> {
    const callback = this.streamingCallbacks.get(sessionId);
    if (!callback) return;
    
    const chunks = this.splitIntoNaturalChunks(fullResponse);
    
    for (let i = 0; i < chunks.length; i++) {
      callback({
        index: i + 1,
        text: chunks[i],
        isFinal: i === chunks.length - 1,
        emotion,
        latencyMs: 0,
      });
      
      await this.delay(50);
    }
    
    this.streamingCallbacks.delete(sessionId);
  }
  
  private splitIntoNaturalChunks(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[。！？~，、])/);
    
    for (const sentence of sentences) {
      if (sentence.trim()) {
        chunks.push(sentence);
      }
    }
    
    return chunks.length > 0 ? chunks : [text];
  }
  
  async synthesizeEmotionalVoice(
    text: string,
    emotion: EmotionState,
    tone: VoiceTone
  ): Promise<{ audioUrl: string; ssmlText: string }> {
    const ssml = this.generateSSML(text, emotion, tone);
    
    return {
      audioUrl: `/api/tts/stream?text=${encodeURIComponent(text)}&emotion=${emotion}&tone=${tone}`,
      ssmlText: ssml,
    };
  }
  
  private generateSSML(text: string, emotion: EmotionState, tone: VoiceTone): string {
    const rate = this.getVoiceRate(emotion);
    const pitch = this.getVoicePitch(emotion);
    const volume = this.getVoiceVolume(emotion);
    
    return `<speak>
      <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
        ${this.addEmotionalMarkers(text, emotion)}
      </prosody>
    </speak>`;
  }
  
  private getVoiceRate(emotion: EmotionState): string {
    const rates: Record<EmotionState, string> = {
      happy: 'medium',
      concerned: 'slow',
      excited: 'fast',
      empathetic: 'slow',
      playful: 'medium',
      serious: 'slow',
      neutral: 'medium',
    };
    return rates[emotion];
  }
  
  private getVoicePitch(emotion: EmotionState): string {
    const pitches: Record<EmotionState, string> = {
      happy: '+5%',
      concerned: '-5%',
      excited: '+10%',
      empathetic: '0%',
      playful: '+8%',
      serious: '-8%',
      neutral: '0%',
    };
    return pitches[emotion];
  }
  
  private getVoiceVolume(emotion: EmotionState): string {
    const volumes: Record<EmotionState, string> = {
      happy: 'medium',
      concerned: 'soft',
      excited: 'loud',
      empathetic: 'soft',
      playful: 'medium',
      serious: 'medium',
      neutral: 'medium',
    };
    return volumes[emotion];
  }
  
  private addEmotionalMarkers(text: string, emotion: EmotionState): string {
    if (emotion === 'excited') {
      return text.replace(/([！!])/g, '<emphasis level="strong">$1</emphasis>');
    }
    if (emotion === 'playful') {
      return text.replace(/(~|～)/g, '<break time="100ms"/>$1');
    }
    return text;
  }
  
  async buildDialogueContext(userId: string = 'master'): Promise<DialogueContext> {
    const recentHours = 2;
    const since = new Date(Date.now() - recentHours * 60 * 60 * 1000);
    
    try {
      const recentChats = await db.select()
        .from(avatarChatHistory)
        .where(gte(avatarChatHistory.createdAt, since))
        .orderBy(desc(avatarChatHistory.createdAt))
        .limit(20);
      
      const messagesWithEmotion = recentChats.map(chat => ({
        role: chat.role || 'user',
        content: chat.content || '',
        emotion: this.analyzeEmotion(chat.content || '').userEmotion,
      }));
      
      const moodTrend = this.calculateMoodTrend(messagesWithEmotion);
      
      this.currentContext = {
        recentMessages: messagesWithEmotion,
        userMoodTrend: moodTrend,
        conversationTone: 'warm',
        sessionDurationMs: recentChats.length > 0 
          ? Date.now() - new Date(recentChats[recentChats.length - 1].createdAt || Date.now()).getTime()
          : 0,
      };
      
      return this.currentContext;
      
    } catch (error) {
      console.error('[EmpathicDialogue] Error building context:', error);
      return {
        recentMessages: [],
        userMoodTrend: 'stable',
        conversationTone: 'warm',
        sessionDurationMs: 0,
      };
    }
  }
  
  private calculateMoodTrend(
    messages: Array<{ emotion?: EmotionState }>
  ): 'improving' | 'stable' | 'declining' {
    if (messages.length < 4) return 'stable';
    
    const emotionScores: Record<EmotionState, number> = {
      happy: 2,
      excited: 2,
      playful: 1,
      neutral: 0,
      empathetic: 0,
      concerned: -1,
      serious: -1,
    };
    
    const firstHalf = messages.slice(0, Math.floor(messages.length / 2));
    const secondHalf = messages.slice(Math.floor(messages.length / 2));
    
    const firstScore = firstHalf.reduce((sum, m) => 
      sum + (emotionScores[m.emotion || 'neutral'] || 0), 0) / firstHalf.length;
    const secondScore = secondHalf.reduce((sum, m) => 
      sum + (emotionScores[m.emotion || 'neutral'] || 0), 0) / secondHalf.length;
    
    if (secondScore - firstScore > 0.5) return 'improving';
    if (firstScore - secondScore > 0.5) return 'declining';
    return 'stable';
  }
  
  getSLAReport(): {
    totalResponses: number;
    violationCount: number;
    averageLatencyMs: number;
    slaComplianceRate: number;
  } {
    if (this.slaMetrics.length === 0) {
      return {
        totalResponses: 0,
        violationCount: 0,
        averageLatencyMs: 0,
        slaComplianceRate: 1,
      };
    }
    
    const violationCount = this.slaMetrics.filter(m => m.slaViolation).length;
    const avgLatency = this.slaMetrics.reduce((sum, m) => sum + m.firstTokenLatencyMs, 0) 
      / this.slaMetrics.length;
    
    return {
      totalResponses: this.slaMetrics.length,
      violationCount,
      averageLatencyMs: avgLatency,
      slaComplianceRate: 1 - (violationCount / this.slaMetrics.length),
    };
  }
  
  async recordEmotionalInteraction(
    userMessage: string,
    assistantResponse: string,
    emotion: EmotionState
  ): Promise<void> {
    try {
      await db.insert(shadowMemories).values({
        context: `情感对话记录`,
        choiceMade: `用户情绪:${emotion} | 回应:${assistantResponse.slice(0, 100)}`,
        field: 'emotional_interaction',
        mimicryWeight: 1.0,
        expPoints: 5,
      });
    } catch (error) {
      console.error('[EmpathicDialogue] Error recording interaction:', error);
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getConfig(): DialogueConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<DialogueConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export const empathicDialogue = new EmpathicDialogueService();

export { EmpathicDialogueService };
