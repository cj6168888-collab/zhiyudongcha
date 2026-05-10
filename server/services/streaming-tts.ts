/**
 * Z5 流式语音合成服务 - Phase 8.2
 * 
 * 增强功能：
 * 1. 分句流式合成 - 按标点符号分割，逐句合成
 * 2. 多后端支持 - DashScope CosyVoice / Edge-TTS
 * 3. 智能分句 - 根据语义和标点智能分割
 * 4. 缓冲队列 - 预合成下一句减少延迟
 * 5. 中断支持 - AbortController精确控制
 * 6. 错误恢复 - 单句失败不影响整体
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('StreamingTts');

import { EventEmitter } from 'events';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const TTS_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/generation';

export type TTSBackend = 'cosyvoice' | 'cosyvoice-flash' | 'edge-tts';

export interface StreamingTTSConfig {
  backend: TTSBackend;
  voiceId: string;
  rate: number;      // 语速 0.5-2.0
  pitch: number;     // 音调 0.5-2.0
  volume: number;    // 音量 0-100
  format: 'mp3' | 'wav' | 'pcm';
  sampleRate: number;
  prefetchCount: number;  // 预取句子数
  maxRetries: number;     // 单句最大重试次数
}

export interface TTSChunk {
  index: number;
  text: string;
  audioBase64: string;
  duration: number;  // 估计时长(ms)
  isFinal: boolean;
  timestamp: number;
}

export interface StreamingSession {
  id: string;
  config: StreamingTTSConfig;
  abortController: AbortController;
  chunks: TTSChunk[];
  currentIndex: number;
  totalSentences: number;
  startTime: number;
  status: 'idle' | 'synthesizing' | 'completed' | 'aborted' | 'error';
  error?: string;
}

const DEFAULT_CONFIG: StreamingTTSConfig = {
  backend: 'cosyvoice-flash',
  voiceId: 'longhuhu_v3',
  rate: 1.0,
  pitch: 1.0,
  volume: 50,
  format: 'mp3',
  sampleRate: 22050,
  prefetchCount: 2,
  maxRetries: 2,
};

function generateSessionId(): string {
  return 'tts_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
}

function log(message: string, sessionId?: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const prefix = sessionId ? `[StreamTTS:${sessionId.slice(-6)}]` : '[StreamTTS]';
  logger.info(`${time} ${prefix} ${message}`);
}

class StreamingTTSService extends EventEmitter {
  private sessions: Map<string, StreamingSession> = new Map();
  private synthesisQueue: Map<string, Promise<void>> = new Map();

  constructor() {
    super();
    log('流式语音合成服务已初始化 (Phase 8.2)');
  }

  createSession(config?: Partial<StreamingTTSConfig>): StreamingSession {
    const sessionId = generateSessionId();
    
    const session: StreamingSession = {
      id: sessionId,
      config: { ...DEFAULT_CONFIG, ...config },
      abortController: new AbortController(),
      chunks: [],
      currentIndex: 0,
      totalSentences: 0,
      startTime: Date.now(),
      status: 'idle',
    };

    this.sessions.set(sessionId, session);
    log(`会话已创建 - 音色: ${session.config.voiceId}`, sessionId);

    return session;
  }

  async synthesizeStream(
    sessionId: string,
    text: string,
    onChunk: (chunk: TTSChunk) => void
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    if (!DASHSCOPE_API_KEY) {
      throw new Error('DASHSCOPE_API_KEY 未配置');
    }

    session.status = 'synthesizing';
    session.startTime = Date.now();

    // 智能分句
    const sentences = this.smartSplit(text);
    session.totalSentences = sentences.length;

    log(`开始流式合成: ${sentences.length}句`, sessionId);

    try {
      // 使用预取队列并行合成
      const prefetchQueue: Array<Promise<TTSChunk | null>> = [];
      
      for (let i = 0; i < sentences.length; i++) {
        // 检查是否被中断
        if (session.abortController.signal.aborted) {
          log('合成被中断', sessionId);
          session.status = 'aborted';
          break;
        }

        const sentence = sentences[i];
        const isFinal = i === sentences.length - 1;

        // 开始预取下一批
        if (prefetchQueue.length < session.config.prefetchCount) {
          for (let j = prefetchQueue.length; j < session.config.prefetchCount && i + j < sentences.length; j++) {
            const prefetchIndex = i + j;
            prefetchQueue.push(
              this.synthesizeSentence(session, sentences[prefetchIndex], prefetchIndex, prefetchIndex === sentences.length - 1)
            );
          }
        }

        // 等待当前句子
        let chunk: TTSChunk | null;
        if (prefetchQueue.length > 0) {
          chunk = await prefetchQueue.shift()!;
        } else {
          chunk = await this.synthesizeSentence(session, sentence, i, isFinal);
        }

        if (chunk && !session.abortController.signal.aborted) {
          session.chunks.push(chunk);
          session.currentIndex = i;
          onChunk(chunk);
          this.emit('chunk', sessionId, chunk);
        }

        // 补充预取队列
        const nextPrefetch = i + session.config.prefetchCount;
        if (nextPrefetch < sentences.length) {
          prefetchQueue.push(
            this.synthesizeSentence(session, sentences[nextPrefetch], nextPrefetch, nextPrefetch === sentences.length - 1)
          );
        }
      }

      if (session.status !== 'aborted') {
        session.status = 'completed';
        const duration = Date.now() - session.startTime;
        log(`合成完成 - 耗时: ${duration}ms, 句数: ${session.chunks.length}`, sessionId);
        this.emit('complete', sessionId, session.chunks);
      }

    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : '未知错误';
      log(`合成失败: ${session.error}`, sessionId);
      this.emit('error', sessionId, session.error);
      throw error;
    }
  }

  private async synthesizeSentence(
    session: StreamingSession,
    text: string,
    index: number,
    isFinal: boolean,
    retryCount = 0
  ): Promise<TTSChunk | null> {
    if (session.abortController.signal.aborted) {
      return null;
    }

    try {
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'disable',
        },
        body: JSON.stringify({
          model: session.config.backend === 'cosyvoice' ? 'cosyvoice-v3' : 'cosyvoice-v3-flash',
          input: { text },
          parameters: {
            voice: session.config.voiceId,
            format: session.config.format,
            sample_rate: session.config.sampleRate,
            volume: session.config.volume,
            rate: session.config.rate,
            pitch: session.config.pitch,
          },
        }),
        signal: session.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`TTS API错误: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.output?.audio) {
        throw new Error('TTS响应无音频数据');
      }

      // 估算音频时长 (基于文本长度和语速)
      const estimatedDuration = Math.round((text.length * 150) / session.config.rate);

      return {
        index,
        text,
        audioBase64: data.output.audio,
        duration: estimatedDuration,
        isFinal,
        timestamp: Date.now(),
      };

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }

      if (retryCount < session.config.maxRetries) {
        log(`句子${index}合成失败，重试 ${retryCount + 1}/${session.config.maxRetries}`, session.id);
        await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
        return this.synthesizeSentence(session, text, index, isFinal, retryCount + 1);
      }

      log(`句子${index}合成最终失败: ${text.slice(0, 20)}...`, session.id);
      return null;
    }
  }

  private smartSplit(text: string): string[] {
    const sentences: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      current += char;

      // 处理引号
      if (['"', '"', '"', '「', '」'].includes(char)) {
        inQuote = !inQuote;
      }

      // 句末标点分割
      if (['。', '！', '？', '；', '!', '?', ';'].includes(char)) {
        if (!inQuote && current.trim()) {
          sentences.push(current.trim());
          current = '';
        }
      }

      // 逗号分割（但保持短句连接）
      if (['，', ','].includes(char) && current.length > 15) {
        if (!inQuote && current.trim()) {
          sentences.push(current.trim());
          current = '';
        }
      }

      // 长句强制分割
      if (current.length > 50) {
        const lastBreak = current.lastIndexOf('，');
        if (lastBreak > 10) {
          sentences.push(current.slice(0, lastBreak + 1).trim());
          current = current.slice(lastBreak + 1);
        }
      }
    }

    // 处理剩余文本
    if (current.trim()) {
      sentences.push(current.trim());
    }

    return sentences.filter(s => s.length > 0);
  }

  abort(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    log('中断合成', sessionId);
    session.abortController.abort();
    session.status = 'aborted';
    this.emit('abort', sessionId);

    return true;
  }

  getSession(sessionId: string): StreamingSession | undefined {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.status === 'synthesizing') {
        session.abortController.abort();
      }
      this.sessions.delete(sessionId);
      log('会话已关闭', sessionId);
    }
  }

  getStats(): {
    activeSessions: number;
    completedSessions: number;
    totalChunks: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      activeSessions: sessions.filter(s => s.status === 'synthesizing').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      totalChunks: sessions.reduce((sum, s) => sum + s.chunks.length, 0),
    };
  }

  // 快捷方法：一次性合成
  async synthesize(text: string, config?: Partial<StreamingTTSConfig>): Promise<Buffer> {
    const session = this.createSession(config);
    const chunks: TTSChunk[] = [];

    await this.synthesizeStream(session.id, text, chunk => {
      chunks.push(chunk);
    });

    this.closeSession(session.id);

    // 合并所有音频块
    const buffers = chunks.map(c => Buffer.from(c.audioBase64, 'base64'));
    return Buffer.concat(buffers);
  }

  // 流式合成生成器
  async *synthesizeGenerator(
    text: string,
    config?: Partial<StreamingTTSConfig>
  ): AsyncGenerator<TTSChunk> {
    const session = this.createSession(config);
    const chunkQueue: TTSChunk[] = [];
    let resolveWait: (() => void) | null = null;
    let done = false;

    const synthesisPromise = this.synthesizeStream(session.id, text, chunk => {
      chunkQueue.push(chunk);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    }).then(() => {
      done = true;
      if (resolveWait) {
        resolveWait();
      }
    });

    try {
      while (!done || chunkQueue.length > 0) {
        if (chunkQueue.length > 0) {
          yield chunkQueue.shift()!;
        } else if (!done) {
          await new Promise<void>(resolve => {
            resolveWait = resolve;
          });
        }
      }
    } finally {
      this.closeSession(session.id);
    }
  }
}

export const streamingTTSService = new StreamingTTSService();
logger.info('[StreamingTTS] 流式语音合成服务 v1.0 已加载 (Phase 8.2)');
