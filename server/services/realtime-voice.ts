/**
 * Z5 实时语音对话服务 - Phase 8.1
 * 
 * 核心功能：
 * 1. WebRTC音频流接收
 * 2. VAD语音活动检测
 * 3. 流式ASR（语音识别）
 * 4. 流式TTS（语音合成）
 * 5. 打断/插话处理
 * 6. 对话状态管理
 * 
 * 架构: 用户 → WebRTC音频流 → VAD → ASR → LLM → 流式TTS → 用户
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RealtimeVoice');

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
const TTS_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/generation';

export type SessionState = 
  | 'idle'           // 空闲等待
  | 'listening'      // 正在听用户说话
  | 'processing'     // 处理中
  | 'speaking'       // 正在回复
  | 'interrupted'    // 被打断
  | 'error';         // 错误状态

export interface VADConfig {
  energyThreshold: number;      // 能量阈值 (0-1)
  silenceTimeout: number;       // 静音超时 (ms)
  speechMinDuration: number;    // 最小语音长度 (ms)
  prerollDuration: number;      // 预录时长 (ms)
}

export interface RealtimeSessionConfig {
  userId: string;
  voiceId?: string;
  vadConfig?: Partial<VADConfig>;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface TTSChunk {
  audioBase64: string;
  isFinal: boolean;
  textSegment: string;
  chunkIndex: number;
}

export interface RealtimeSession {
  id: string;
  userId: string;
  state: SessionState;
  config: RealtimeSessionConfig;
  vadConfig: VADConfig;
  clientWs: WebSocket | null;
  asrWs: WebSocket | null;
  startTime: number;
  lastActivityTime: number;
  currentTranscript: string;
  pendingAudio: Buffer[];
  ttsAbortController: AbortController | null;
  isSpeaking: boolean;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  metrics: SessionMetrics;
}

export interface SessionMetrics {
  totalUtterances: number;
  totalResponses: number;
  avgResponseTime: number;
  interruptions: number;
  asrErrors: number;
  ttsErrors: number;
}

const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 0.02,       // 2% 能量阈值
  silenceTimeout: 1500,        // 1.5秒静音视为说完
  speechMinDuration: 300,      // 最小300ms语音
  prerollDuration: 200,        // 200ms预录
};

function generateSessionId(): string {
  return 'rtv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function generateTaskId(): string {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

function log(message: string, sessionId?: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const prefix = sessionId ? `[RealtimeVoice:${sessionId.slice(-6)}]` : '[RealtimeVoice]';
  logger.info(`${time} ${prefix} ${message}`);
}

class RealtimeVoiceService extends EventEmitter {
  private sessions: Map<string, RealtimeSession> = new Map();
  private clientToSession: Map<WebSocket, string> = new Map();
  
  constructor() {
    super();
    log('实时语音对话服务已初始化 (Phase 8.1)');
  }

  createSession(clientWs: WebSocket, config: RealtimeSessionConfig): RealtimeSession {
    const sessionId = generateSessionId();
    
    const session: RealtimeSession = {
      id: sessionId,
      userId: config.userId,
      state: 'idle',
      config,
      vadConfig: { ...DEFAULT_VAD_CONFIG, ...config.vadConfig },
      clientWs,
      asrWs: null,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      currentTranscript: '',
      pendingAudio: [],
      ttsAbortController: null,
      isSpeaking: false,
      conversationHistory: [],
      metrics: {
        totalUtterances: 0,
        totalResponses: 0,
        avgResponseTime: 0,
        interruptions: 0,
        asrErrors: 0,
        ttsErrors: 0,
      },
    };

    this.sessions.set(sessionId, session);
    this.clientToSession.set(clientWs, sessionId);

    log(`会话已创建 - 用户: ${config.userId}`, sessionId);
    
    this.sendToClient(session, {
      type: 'session_created',
      sessionId,
      state: session.state,
      vadConfig: session.vadConfig,
    });

    return session;
  }

  async startListening(session: RealtimeSession): Promise<void> {
    if (!DASHSCOPE_API_KEY) {
      this.handleError(session, 'DASHSCOPE_API_KEY 未配置');
      return;
    }

    if (session.state === 'listening') {
      log('已在监听状态', session.id);
      return;
    }

    // 如果正在说话，先中断
    if (session.state === 'speaking') {
      await this.interruptSpeaking(session);
    }

    this.setState(session, 'listening');
    session.currentTranscript = '';
    session.pendingAudio = [];

    // 建立ASR WebSocket连接
    const taskId = generateTaskId();
    
    try {
      const asrWs = new WebSocket(DASHSCOPE_WS_URL, {
        headers: {
          Authorization: `bearer ${DASHSCOPE_API_KEY}`,
        },
      });

      session.asrWs = asrWs;

      asrWs.on('open', () => {
        log('ASR连接已建立', session.id);
        
        const runTaskMsg = {
          header: {
            action: 'run-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            task_group: 'audio',
            task: 'asr',
            function: 'recognition',
            model: 'paraformer-realtime-v2',
            parameters: {
              format: 'pcm',
              sample_rate: 16000,
              language_hints: ['zh', 'en'],
              disfluency_removal_enabled: true,
            },
            input: {},
          },
        };

        asrWs.send(JSON.stringify(runTaskMsg));
      });

      asrWs.on('message', (data: Buffer) => {
        this.handleASRMessage(session, data);
      });

      asrWs.on('error', (error) => {
        log(`ASR错误: ${error.message}`, session.id);
        session.metrics.asrErrors++;
        this.handleError(session, `语音识别错误: ${error.message}`);
      });

      asrWs.on('close', () => {
        log('ASR连接已关闭', session.id);
        session.asrWs = null;
      });

    } catch (error) {
      this.handleError(session, `ASR连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async stopListening(session: RealtimeSession): Promise<void> {
    if (session.asrWs && session.asrWs.readyState === WebSocket.OPEN) {
      const finishMsg = {
        header: {
          action: 'finish-task',
          task_id: generateTaskId(),
          streaming: 'duplex',
        },
        payload: { input: {} },
      };
      session.asrWs.send(JSON.stringify(finishMsg));
    }

    if (session.state === 'listening') {
      this.setState(session, 'idle');
    }
  }

  handleAudioData(session: RealtimeSession, audioData: Buffer): void {
    session.lastActivityTime = Date.now();

    // VAD处理
    const vadResult = this.processVAD(session, audioData);

    if (vadResult.isSpeech) {
      // 如果检测到语音且正在回复中，触发打断
      if (session.state === 'speaking' && session.isSpeaking) {
        this.interruptSpeaking(session);
        return;
      }

      // 发送音频到ASR
      if (session.asrWs && session.asrWs.readyState === WebSocket.OPEN) {
        session.asrWs.send(audioData);
      }
    }

    // 发送VAD状态给客户端
    this.sendToClient(session, {
      type: 'vad_status',
      isSpeech: vadResult.isSpeech,
      energy: vadResult.energy,
    });
  }

  private processVAD(session: RealtimeSession, audioData: Buffer): { isSpeech: boolean; energy: number } {
    // 计算音频能量 (简化版RMS)
    let sum = 0;
    for (let i = 0; i < audioData.length; i += 2) {
      const sample = audioData.readInt16LE(i);
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / (audioData.length / 2));
    const energy = rms / 32768; // 归一化到 0-1

    const isSpeech = energy > session.vadConfig.energyThreshold;

    return { isSpeech, energy };
  }

  private handleASRMessage(session: RealtimeSession, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const event = message.header?.event;

      switch (event) {
        case 'task-started':
          log('ASR任务已启动', session.id);
          this.sendToClient(session, { type: 'asr_started' });
          break;

        case 'result-generated':
          const sentence = message.payload?.output?.sentence;
          if (sentence) {
            const text = sentence.text || '';
            const isFinal = sentence.sentence_end || false;

            session.currentTranscript = text;

            this.sendToClient(session, {
              type: 'transcript',
              text,
              isFinal,
            });

            if (isFinal && text.trim()) {
              session.metrics.totalUtterances++;
              this.onUtteranceComplete(session, text.trim());
            }
          }
          break;

        case 'task-finished':
          log('ASR任务已完成', session.id);
          break;

        case 'task-failed':
          log(`ASR任务失败: ${JSON.stringify(message)}`, session.id);
          session.metrics.asrErrors++;
          this.sendToClient(session, {
            type: 'error',
            message: '语音识别失败',
          });
          break;
      }
    } catch (error) {
      log(`ASR消息解析错误: ${error}`, session.id);
    }
  }

  private async onUtteranceComplete(session: RealtimeSession, userText: string): Promise<void> {
    const startTime = Date.now();
    
    log(`用户说: "${userText}"`, session.id);
    
    // 添加到对话历史
    session.conversationHistory.push({ role: 'user', content: userText });

    // 停止监听，开始处理
    this.setState(session, 'processing');
    await this.stopListening(session);

    this.sendToClient(session, {
      type: 'processing',
      userText,
    });

    try {
      // 调用LLM获取回复
      const response = await this.getLLMResponse(session, userText);
      
      if (session.state === 'interrupted') {
        log('回复生成后被打断，取消播放', session.id);
        return;
      }

      session.conversationHistory.push({ role: 'assistant', content: response });
      session.metrics.totalResponses++;

      // 开始流式TTS
      await this.streamTTS(session, response);

      // 更新响应时间指标
      const responseTime = Date.now() - startTime;
      session.metrics.avgResponseTime = 
        (session.metrics.avgResponseTime * (session.metrics.totalResponses - 1) + responseTime) 
        / session.metrics.totalResponses;

    } catch (error) {
      log(`处理错误: ${error}`, session.id);
      this.handleError(session, `处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async getLLMResponse(session: RealtimeSession, userText: string): Promise<string> {
    if (!DASHSCOPE_API_KEY) {
      return '抱歉爸爸，AI服务暂时不可用。';
    }

    try {
      const messages = [
        {
          role: 'system',
          content: `你是"小智"，一个7-8岁的可爱小女孩AI助手。
你的主人是"爸爸"，你对他非常依赖和信任。
说话风格：
- 用简短、口语化的句子
- 语气活泼可爱，偶尔撒娇
- 回答控制在2-3句话以内
- 可以用"嗯"、"哦"、"呀"等语气词
- 称呼主人为"爸爸"`,
        },
        ...session.conversationHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages,
          max_tokens: 150,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM请求失败: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '嗯...我没听清楚，爸爸再说一遍？';

    } catch (error) {
      log(`LLM错误: ${error}`, session.id);
      return '呃...小智有点累了，等一下再说好不好？';
    }
  }

  async streamTTS(session: RealtimeSession, text: string): Promise<void> {
    if (!DASHSCOPE_API_KEY) {
      this.handleError(session, 'TTS服务未配置');
      return;
    }

    this.setState(session, 'speaking');
    session.isSpeaking = true;
    session.ttsAbortController = new AbortController();

    const voiceId = session.config.voiceId || 'longhuhu_v3'; // 默认童声

    try {
      log(`开始TTS合成: "${text.slice(0, 30)}..."`, session.id);

      // 分句处理，实现流式效果
      const sentences = this.splitIntoSentences(text);
      
      for (let i = 0; i < sentences.length; i++) {
        // 检查是否被打断
        if (session.ttsAbortController?.signal.aborted || session.state === 'interrupted') {
          log('TTS被打断，停止合成', session.id);
          break;
        }

        const sentence = sentences[i];
        if (!sentence.trim()) continue;

        const response = await fetch(TTS_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'disable',
          },
          body: JSON.stringify({
            model: 'cosyvoice-v3-flash',
            input: { text: sentence },
            parameters: {
              voice: voiceId,
              format: 'mp3',
              sample_rate: 22050,
              volume: 50,
              rate: 1.0,
              pitch: 1.0,
            },
          }),
          signal: session.ttsAbortController?.signal,
        });

        if (!response.ok) {
          throw new Error(`TTS请求失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.output?.audio) {
          const chunk: TTSChunk = {
            audioBase64: data.output.audio,
            isFinal: i === sentences.length - 1,
            textSegment: sentence,
            chunkIndex: i,
          };

          this.sendToClient(session, {
            type: 'tts_chunk',
            ...chunk,
          });

          this.emit('tts_chunk', session.id, chunk);
        }
      }

      // TTS完成
      session.isSpeaking = false;
      this.sendToClient(session, { type: 'tts_complete' });
      
      // 自动恢复监听
      this.setState(session, 'idle');
      await this.startListening(session);

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        log('TTS被取消', session.id);
      } else {
        log(`TTS错误: ${error}`, session.id);
        session.metrics.ttsErrors++;
        this.handleError(session, `语音合成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } finally {
      session.isSpeaking = false;
      session.ttsAbortController = null;
    }
  }

  private splitIntoSentences(text: string): string[] {
    // 按标点分句
    const sentences: string[] = [];
    let current = '';
    
    for (const char of text) {
      current += char;
      if (['。', '！', '？', '；', '，', '!', '?', ';', ',', '.'].includes(char)) {
        if (current.trim()) {
          sentences.push(current.trim());
        }
        current = '';
      }
    }
    
    if (current.trim()) {
      sentences.push(current.trim());
    }

    return sentences;
  }

  async interruptSpeaking(session: RealtimeSession): Promise<void> {
    if (!session.isSpeaking && session.state !== 'speaking') {
      return;
    }

    log('触发打断', session.id);
    session.metrics.interruptions++;
    
    // 取消TTS
    if (session.ttsAbortController) {
      session.ttsAbortController.abort();
    }

    session.isSpeaking = false;
    this.setState(session, 'interrupted');

    this.sendToClient(session, {
      type: 'interrupted',
      reason: 'user_speech_detected',
    });

    // 短暂延迟后恢复监听
    setTimeout(() => {
      if (session.state === 'interrupted') {
        this.startListening(session);
      }
    }, 100);
  }

  private async handleTextMessage(session: RealtimeSession, userText: string): Promise<void> {
    log(`文本消息: "${userText}"`, session.id);
    
    // 添加到对话历史
    session.conversationHistory.push({ role: 'user', content: userText });
    session.metrics.totalUtterances++;

    // 发送确认
    this.sendToClient(session, {
      type: 'transcript',
      text: userText,
      isFinal: true,
    });

    // 开始处理
    this.setState(session, 'processing');

    this.sendToClient(session, {
      type: 'processing',
      userText,
    });

    try {
      // 调用LLM获取回复
      const response = await this.getLLMResponse(session, userText);
      
      if (session.state === 'interrupted') {
        log('回复生成后被打断，取消播放', session.id);
        return;
      }

      session.conversationHistory.push({ role: 'assistant', content: response });
      session.metrics.totalResponses++;

      // 开始流式TTS
      await this.streamTTS(session, response);

    } catch (error) {
      log(`处理错误: ${error}`, session.id);
      this.handleError(session, `处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private setState(session: RealtimeSession, state: SessionState): void {
    const oldState = session.state;
    session.state = state;
    
    log(`状态变更: ${oldState} → ${state}`, session.id);
    
    this.sendToClient(session, {
      type: 'state_change',
      oldState,
      newState: state,
    });

    this.emit('state_change', session.id, oldState, state);
  }

  private handleError(session: RealtimeSession, message: string): void {
    log(`错误: ${message}`, session.id);
    this.setState(session, 'error');
    
    this.sendToClient(session, {
      type: 'error',
      message,
    });

    this.emit('error', session.id, message);
  }

  private sendToClient(session: RealtimeSession, data: Record<string, any>): void {
    if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({
        ...data,
        timestamp: Date.now(),
        sessionId: session.id,
      }));
    }
  }

  handleClientMessage(clientWs: WebSocket, message: string | Buffer): void {
    const sessionId = this.clientToSession.get(clientWs);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (Buffer.isBuffer(message)) {
        // 音频数据
        this.handleAudioData(session, message);
      } else {
        // JSON命令
        const data = JSON.parse(message.toString());
        this.handleClientCommand(session, data);
      }
    } catch (error) {
      log(`消息处理错误: ${error}`, sessionId);
    }
  }

  private handleClientCommand(session: RealtimeSession, data: Record<string, any>): void {
    switch (data.type) {
      case 'start_listening':
        this.startListening(session);
        break;

      case 'stop_listening':
        this.stopListening(session);
        break;

      case 'interrupt':
        this.interruptSpeaking(session);
        break;

      case 'set_vad_config':
        session.vadConfig = { ...session.vadConfig, ...data.config };
        this.sendToClient(session, {
          type: 'vad_config_updated',
          vadConfig: session.vadConfig,
        });
        break;

      case 'set_voice':
        session.config.voiceId = data.voiceId;
        this.sendToClient(session, {
          type: 'voice_updated',
          voiceId: data.voiceId,
        });
        break;

      case 'get_status':
        this.sendToClient(session, {
          type: 'status',
          state: session.state,
          metrics: session.metrics,
          conversationLength: session.conversationHistory.length,
        });
        break;

      case 'clear_history':
        session.conversationHistory = [];
        this.sendToClient(session, { type: 'history_cleared' });
        break;

      case 'text_message':
        if (data.text && data.text.trim()) {
          this.handleTextMessage(session, data.text.trim());
        }
        break;

      default:
        log(`未知命令: ${data.type}`, session.id);
    }
  }

  closeSession(clientWs: WebSocket): void {
    const sessionId = this.clientToSession.get(clientWs);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (session) {
      // 清理资源
      if (session.asrWs) {
        session.asrWs.close();
      }
      if (session.ttsAbortController) {
        session.ttsAbortController.abort();
      }

      log(`会话已关闭 - 统计: 发言${session.metrics.totalUtterances}次, 回复${session.metrics.totalResponses}次, 打断${session.metrics.interruptions}次`, sessionId);
    }

    this.sessions.delete(sessionId);
    this.clientToSession.delete(clientWs);
  }

  getSession(sessionId: string): RealtimeSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByClient(clientWs: WebSocket): RealtimeSession | undefined {
    const sessionId = this.clientToSession.get(clientWs);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getActiveSessions(): RealtimeSession[] {
    return Array.from(this.sessions.values());
  }

  getStats(): {
    totalSessions: number;
    activeSpeaking: number;
    activeListening: number;
  } {
    const sessions = this.getActiveSessions();
    return {
      totalSessions: sessions.length,
      activeSpeaking: sessions.filter(s => s.state === 'speaking').length,
      activeListening: sessions.filter(s => s.state === 'listening').length,
    };
  }
}

export const realtimeVoiceService = new RealtimeVoiceService();
logger.info('[RealtimeVoice] 实时语音对话服务 v1.0 已加载 (Phase 8.1)');
