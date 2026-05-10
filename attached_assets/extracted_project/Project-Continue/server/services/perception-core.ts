/**
 * 小智感知核心 (Perception Core)
 * 
 * 让小智拥有真正的感官：
 * - 👁️ 视觉：通过INMO Go3摄像头"看"
 * - 👂 听觉：通过INMO Go3麦克风"听"
 * - 🧠 理解：融合视觉+听觉信息，给出智能响应
 * 
 * 架构：
 * INMO Go3 眼镜 → 感知核心 → AI理解 → 响应输出
 */

import { inmoBridgeService } from './inmo-bridge';
import { getModulePrompt } from '../config/persona';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_VL_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DASHSCOPE_TEXT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export interface PerceptionSession {
  id: string;
  deviceId: string;
  startedAt: Date;
  lastActivity: Date;
  isActive: boolean;
  visionEnabled: boolean;
  audioEnabled: boolean;
  context: PerceptionContext;
  userRole: 'MASTER' | 'GUEST';
}

export interface PerceptionContext {
  recentVision: VisionFrame[];
  recentAudio: AudioSegment[];
  currentScene: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userIntent: string | null;
  environmentType: 'indoor' | 'outdoor' | 'meeting' | 'dining' | 'travel' | 'unknown';
}

export interface VisionFrame {
  timestamp: number;
  imageBase64?: string;
  description: string;
  objects: string[];
  text: string[];
  faces: number;
  mood: string;
}

export interface AudioSegment {
  timestamp: number;
  transcript: string;
  speaker: 'user' | 'other' | 'unknown';
  language: string;
  emotion: string;
}

export interface PerceptionResponse {
  type: 'DISPLAY' | 'SPEAK' | 'BOTH' | 'SILENT';
  displayText?: string;
  speakText?: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  action?: string;
  reasoning?: string;
}

const PERCEPTION_MODULE_CONTEXT = `
【你的感知能力】
- 视觉：你能看到主人眼前的画面，识别文字、物体、人脸、场景
- 听觉：你能听到周围的对话和声音

【你的响应原则】
1. 主动但不打扰：只在有重要信息时主动提醒
2. 简洁有用：眼镜显示空间有限，每次最多显示1-2行
3. 情境感知：根据场景调整响应方式
4. 保护隐私：不记录敏感信息

【响应格式】
根据情况选择：
- DISPLAY：仅在眼镜上显示文字（适合阅读场景）
- SPEAK：仅语音播报（适合不方便看屏幕时）
- BOTH：同时显示和播报（重要提醒）
- SILENT：不需要响应（普通场景）

【典型场景响应】
- 看到菜单 → 显示推荐菜品或提醒（如"这道菜评价4.8分"）
- 看到合同 → 提醒关键条款风险
- 听到对方说外语 → 实时翻译显示
- 听到会议讨论 → 记录要点
- 看到陌生人 → 如果是已知联系人，显示信息
- 普通走路场景 → 保持安静，不打扰

请根据主人"看到"和"听到"的内容，决定是否需要响应以及如何响应。`;

function buildPerceptionPrompt(role: 'MASTER' | 'GUEST' = 'MASTER'): string {
  return getModulePrompt('PERCEPTION', role, PERCEPTION_MODULE_CONTEXT);
}

class PerceptionCoreService {
  private sessions: Map<string, PerceptionSession> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private frameBuffer: Map<string, VisionFrame[]> = new Map();
  private audioBuffer: Map<string, AudioSegment[]> = new Map();

  async createSession(deviceId: string, userRole: 'MASTER' | 'GUEST' = 'MASTER'): Promise<PerceptionSession> {
    const sessionId = `perception-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const session: PerceptionSession = {
      id: sessionId,
      deviceId,
      startedAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      visionEnabled: true,
      audioEnabled: true,
      userRole,
      context: {
        recentVision: [],
        recentAudio: [],
        currentScene: '未知场景',
        conversationHistory: [],
        userIntent: null,
        environmentType: 'unknown',
      },
    };

    this.sessions.set(sessionId, session);
    this.frameBuffer.set(sessionId, []);
    this.audioBuffer.set(sessionId, []);

    console.log(`[感知核心] 新会话创建: ${sessionId} (设备: ${deviceId})`);
    this.emit('sessionCreated', session);

    return session;
  }

  async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      this.frameBuffer.delete(sessionId);
      this.audioBuffer.delete(sessionId);
      console.log(`[感知核心] 会话结束: ${sessionId}`);
      this.emit('sessionEnded', session);
      return true;
    }
    return false;
  }

  getSession(sessionId: string): PerceptionSession | undefined {
    return this.sessions.get(sessionId);
  }

  async processVisionFrame(
    sessionId: string,
    imageBase64: string
  ): Promise<{ frame: VisionFrame; response: PerceptionResponse | null }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive || !session.visionEnabled) {
      throw new Error('会话无效或视觉功能未启用');
    }

    session.lastActivity = new Date();

    const frame = await this.analyzeImage(imageBase64);
    
    const buffer = this.frameBuffer.get(sessionId) || [];
    buffer.push(frame);
    if (buffer.length > 10) buffer.shift();
    this.frameBuffer.set(sessionId, buffer);

    session.context.recentVision = buffer.slice(-5);
    session.context.currentScene = frame.description;

    const response = await this.generateResponse(session, 'vision', frame);

    this.emit('visionProcessed', { session, frame, response });

    return { frame, response };
  }

  async processAudioSegment(
    sessionId: string,
    transcript: string,
    speaker: 'user' | 'other' | 'unknown' = 'unknown',
    language: string = 'zh-CN'
  ): Promise<{ segment: AudioSegment; response: PerceptionResponse | null }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive || !session.audioEnabled) {
      throw new Error('会话无效或听觉功能未启用');
    }

    session.lastActivity = new Date();

    const segment: AudioSegment = {
      timestamp: Date.now(),
      transcript,
      speaker,
      language,
      emotion: this.detectEmotion(transcript),
    };

    const buffer = this.audioBuffer.get(sessionId) || [];
    buffer.push(segment);
    if (buffer.length > 20) buffer.shift();
    this.audioBuffer.set(sessionId, buffer);

    session.context.recentAudio = buffer.slice(-10);

    const response = await this.generateResponse(session, 'audio', segment);

    this.emit('audioProcessed', { session, segment, response });

    return { segment, response };
  }

  async processCombinedInput(
    sessionId: string,
    imageBase64?: string,
    transcript?: string
  ): Promise<{ response: PerceptionResponse }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error('会话无效');
    }

    session.lastActivity = new Date();

    let visionContext = '';
    let audioContext = '';

    if (imageBase64 && session.visionEnabled) {
      const frame = await this.analyzeImage(imageBase64);
      const buffer = this.frameBuffer.get(sessionId) || [];
      buffer.push(frame);
      if (buffer.length > 10) buffer.shift();
      this.frameBuffer.set(sessionId, buffer);
      session.context.recentVision = buffer.slice(-5);
      visionContext = `【当前看到】${frame.description}`;
      if (frame.text.length > 0) {
        visionContext += `\n识别到的文字：${frame.text.join(', ')}`;
      }
    }

    if (transcript && session.audioEnabled) {
      const segment: AudioSegment = {
        timestamp: Date.now(),
        transcript,
        speaker: 'unknown',
        language: this.detectLanguage(transcript),
        emotion: this.detectEmotion(transcript),
      };
      const buffer = this.audioBuffer.get(sessionId) || [];
      buffer.push(segment);
      if (buffer.length > 20) buffer.shift();
      this.audioBuffer.set(sessionId, buffer);
      session.context.recentAudio = buffer.slice(-10);
      audioContext = `【听到】${transcript}`;
    }

    const response = await this.generateCombinedResponse(session, visionContext, audioContext);

    this.emit('combinedProcessed', { session, response });

    return { response };
  }

  private async analyzeImage(imageBase64: string): Promise<VisionFrame> {
    if (!DASHSCOPE_API_KEY) {
      return {
        timestamp: Date.now(),
        description: '无法分析图像（API未配置）',
        objects: [],
        text: [],
        faces: 0,
        mood: 'neutral',
      };
    }

    try {
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const response = await fetch(DASHSCOPE_VL_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { image: imageUrl },
                  { text: `请分析这张图片，用JSON格式返回：
{
  "description": "简洁描述场景(20字内)",
  "objects": ["识别到的物体列表"],
  "text": ["图中的文字"],
  "faces": 人脸数量,
  "mood": "场景氛围(如formal/casual/tense/relaxed)"
}
只返回JSON，不要其他内容。` },
                ],
              },
            ],
          },
          parameters: { max_tokens: 500 },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.output?.choices?.[0]?.message?.content?.[0]?.text || '';
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            timestamp: Date.now(),
            description: parsed.description || '未知场景',
            objects: parsed.objects || [],
            text: parsed.text || [],
            faces: parsed.faces || 0,
            mood: parsed.mood || 'neutral',
          };
        }
      } catch (e) {
        console.error('[感知核心] JSON解析失败:', e);
      }

      return {
        timestamp: Date.now(),
        description: content.substring(0, 100) || '场景分析中',
        objects: [],
        text: [],
        faces: 0,
        mood: 'neutral',
      };
    } catch (error) {
      console.error('[感知核心] 图像分析失败:', error);
      return {
        timestamp: Date.now(),
        description: '图像分析失败',
        objects: [],
        text: [],
        faces: 0,
        mood: 'neutral',
      };
    }
  }

  private async generateResponse(
    session: PerceptionSession,
    inputType: 'vision' | 'audio',
    input: VisionFrame | AudioSegment
  ): Promise<PerceptionResponse | null> {
    if (!DASHSCOPE_API_KEY) {
      return null;
    }

    let context = '';
    if (inputType === 'vision') {
      const frame = input as VisionFrame;
      context = `【视觉输入】场景：${frame.description}`;
      if (frame.text.length > 0) {
        context += `\n识别文字：${frame.text.join(', ')}`;
      }
      if (frame.objects.length > 0) {
        context += `\n识别物体：${frame.objects.join(', ')}`;
      }
    } else {
      const segment = input as AudioSegment;
      context = `【听觉输入】说话者：${segment.speaker}\n内容：${segment.transcript}\n情绪：${segment.emotion}`;
    }

    return this.callAIForResponse(session, context);
  }

  private async generateCombinedResponse(
    session: PerceptionSession,
    visionContext: string,
    audioContext: string
  ): Promise<PerceptionResponse> {
    if (!DASHSCOPE_API_KEY) {
      return {
        type: 'SILENT',
        urgency: 'LOW',
        reasoning: 'API未配置',
      };
    }

    const context = [visionContext, audioContext].filter(Boolean).join('\n\n');
    
    const response = await this.callAIForResponse(session, context);
    return response || { type: 'SILENT', urgency: 'LOW' };
  }

  private async callAIForResponse(
    session: PerceptionSession,
    context: string
  ): Promise<PerceptionResponse | null> {
    try {
      const recentHistory = session.context.conversationHistory.slice(-4);
      const historyContext = recentHistory.length > 0
        ? `\n\n【最近对话】\n${recentHistory.map(h => `${h.role === 'user' ? '主人' : '小智'}：${h.content}`).join('\n')}`
        : '';

      const response = await fetch(DASHSCOPE_TEXT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              { role: 'system', content: buildPerceptionPrompt(session.userRole) },
              { role: 'user', content: `${context}${historyContext}\n\n请用JSON格式返回你的响应决策：
{
  "type": "DISPLAY/SPEAK/BOTH/SILENT",
  "displayText": "眼镜显示文字(如果需要)",
  "speakText": "语音播报内容(如果需要)",
  "urgency": "LOW/NORMAL/HIGH/URGENT",
  "reasoning": "简述为什么这样响应"
}
只返回JSON。如果场景普通不需要响应，返回 {"type":"SILENT","urgency":"LOW","reasoning":"普通场景"}` },
            ],
          },
          parameters: {
            temperature: 0.3,
            max_tokens: 300,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.output?.text || data.output?.choices?.[0]?.message?.content || '';

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            type: parsed.type || 'SILENT',
            displayText: parsed.displayText,
            speakText: parsed.speakText,
            urgency: parsed.urgency || 'LOW',
            reasoning: parsed.reasoning,
          };
        }
      } catch (e) {
        console.error('[感知核心] 响应解析失败:', e);
      }

      return { type: 'SILENT', urgency: 'LOW' };
    } catch (error) {
      console.error('[感知核心] AI响应生成失败:', error);
      return null;
    }
  }

  async sendResponseToGlasses(
    sessionId: string,
    response: PerceptionResponse
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || response.type === 'SILENT') {
      return false;
    }

    const clients = inmoBridgeService.getAllClients();
    const targetClient = clients.find(c => c.deviceId === session.deviceId);
    
    if (!targetClient) {
      console.log(`[感知核心] 未找到设备 ${session.deviceId} 的连接`);
      return false;
    }

    if (response.type === 'DISPLAY' || response.type === 'BOTH') {
      await inmoBridgeService.sendDisplayMessage(targetClient.id, response.displayText || '', {
        type: 'SUBTITLE',
        duration: response.urgency === 'URGENT' ? 10000 : 5000,
        position: 'BOTTOM',
      });
    }

    if (response.type === 'SPEAK' || response.type === 'BOTH') {
      await inmoBridgeService.sendToClient(targetClient.id, {
        type: 'TTS_REQUEST',
        payload: {
          text: response.speakText || response.displayText,
          urgency: response.urgency,
        },
      });
    }

    return true;
  }

  private detectLanguage(text: string): string {
    if (!text) return 'unknown';
    const hasChineseChar = /[\u4e00-\u9fff]/.test(text);
    const hasJapaneseChar = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    const hasKoreanChar = /[\uac00-\ud7af]/.test(text);
    
    if (hasJapaneseChar) return 'ja';
    if (hasKoreanChar) return 'ko';
    if (hasChineseChar) return 'zh-CN';
    return 'en';
  }

  private detectEmotion(text: string): string {
    if (!text) return 'neutral';
    
    const positivePatterns = /开心|高兴|太好了|哈哈|棒|赞|感谢|谢谢|happy|great|awesome/i;
    const negativePatterns = /生气|难过|郁闷|烦|讨厌|不行|算了|angry|sad|frustrated/i;
    const urgentPatterns = /紧急|马上|立刻|快|urgent|now|immediately/i;
    const questionPatterns = /什么|怎么|为什么|吗|呢|\?|？/;

    if (urgentPatterns.test(text)) return 'urgent';
    if (positivePatterns.test(text)) return 'positive';
    if (negativePatterns.test(text)) return 'negative';
    if (questionPatterns.test(text)) return 'curious';
    
    return 'neutral';
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  getStats(): {
    activeSessions: number;
    totalFramesProcessed: number;
    totalAudioProcessed: number;
  } {
    let totalFrames = 0;
    let totalAudio = 0;
    
    const frameBuffers = Array.from(this.frameBuffer.values());
    for (const buffer of frameBuffers) {
      totalFrames += buffer.length;
    }
    const audioBuffers = Array.from(this.audioBuffer.values());
    for (const buffer of audioBuffers) {
      totalAudio += buffer.length;
    }

    return {
      activeSessions: this.sessions.size,
      totalFramesProcessed: totalFrames,
      totalAudioProcessed: totalAudio,
    };
  }
}

export const perceptionCore = new PerceptionCoreService();
export default PerceptionCoreService;
