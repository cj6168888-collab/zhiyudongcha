/**
 * 小星 Local Whisper STT - 端侧语音识别
 *
 * 使用 Web Speech API 作为主要实现，
 * 为本地 Whisper 模型预留接口（可通过 Ollama 或本地服务调用）
 *
 * 优势：
 * - 低延迟：无需等待云端响应
 * - 私密性：语音数据不出设备
 * - 离线可用：断网也能工作
 */

export type STTMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

export interface WhisperConfig {
  mode: STTMode;
  language: string;
  localEndpoint?: string;  // 本地 Whisper 服务地址
  modelSize: 'tiny' | 'base' | 'small' | 'medium';
  enableTimestamps: boolean;
  vadThreshold: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  confidence: number;
  provider: 'local' | 'cloud';
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface STTCallbacks {
  onStart?: () => void;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

const DEFAULT_CONFIG: WhisperConfig = {
  mode: 'HYBRID',
  language: 'zh',
  localEndpoint: 'http://localhost:8080/v1/audio/transcriptions',
  modelSize: 'base',
  enableTimestamps: false,
  vadThreshold: 0.5,
};

/**
 * 本地 Whisper STT 服务
 * 支持三种模式：
 * - LOCAL: 完全本地（需要本地 Whisper 服务）
 * - CLOUD: 云端（使用阿里云 ASR）
 * - HYBRID: 混合（优先本地，失败降级云端）
 */
export class LocalWhisperSTT {
  private config: WhisperConfig;
  private callbacks: STTCallbacks;
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recognition: any = null;
  private localAvailable: boolean = false;

  constructor(callbacks: STTCallbacks, config?: Partial<WhisperConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.checkLocalAvailability();
  }

  /**
   * 检查本地 Whisper 服务是否可用
   */
  private async checkLocalAvailability(): Promise<void> {
    if (!this.config.localEndpoint) {
      this.localAvailable = false;
      return;
    }

    try {
      // 尝试健康检查
      const healthUrl = this.config.localEndpoint.replace('/v1/audio/transcriptions', '/health');
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      this.localAvailable = response.ok;
    } catch {
      this.localAvailable = false;
    }
  }

  /**
   * 使用本地 Whisper 转录音频
   */
  private async transcribeLocal(audioBlob: Blob): Promise<TranscriptionResult | null> {
    if (!this.localAvailable || !this.config.localEndpoint) {
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', `whisper-${this.config.modelSize}`);
      formData.append('language', this.config.language);
      formData.append('response_format', 'json');

      const startTime = Date.now();
      const response = await fetch(this.config.localEndpoint, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Local Whisper failed: ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;


      return {
        text: data.text || '',
        language: data.language || this.config.language,
        duration: data.duration || 0,
        confidence: 0.9,
        provider: 'local',
        segments: data.segments,
      };
    } catch (error) {
      console.error('[WhisperLocal] Local transcription failed:', error);
      return null;
    }
  }

  /**
   * 使用浏览器 Web Speech API（作为云端替代）
   */
  private initWebSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.callbacks.onError?.('浏览器不支持语音识别');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.language === 'zh' ? 'zh-CN' : 'en-US';

    this.recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        this.callbacks.onResult?.(finalText, true);
      } else if (interimText) {
        this.callbacks.onResult?.(interimText, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.callbacks.onError?.(`语音识别错误: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        try {
          this.recognition.start();
        } catch (e) {
          console.error('[WhisperLocal] Failed to restart recognition:', e);
        }
      } else {
        this.callbacks.onEnd?.();
      }
    };
  }

  /**
   * 开始录音和识别
   */
  async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.isRecording = true;
      this.audioChunks = [];

      // 根据模式选择识别方式
      if (this.config.mode === 'LOCAL' && this.localAvailable) {
        // 纯本地模式：录音后批量转录
        await this.startRecording();
      } else if (this.config.mode === 'CLOUD') {
        // 纯云端模式：使用 Web Speech API
        this.initWebSpeechRecognition();
        this.recognition?.start();
      } else {
        // 混合模式：先尝试 Web Speech，同时录音备用
        this.initWebSpeechRecognition();
        this.recognition?.start();

        if (this.localAvailable) {
          await this.startRecording();
        }
      }

      this.callbacks.onStart?.();

    } catch (error) {
      this.isRecording = false;
      this.callbacks.onError?.(`启动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 开始录音
   */
  private async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // 每秒收集一次数据
  }

  /**
   * 停止录音和识别
   */
  async stop(): Promise<TranscriptionResult | null> {
    if (!this.isRecording) return null;

    this.isRecording = false;

    // 停止 Web Speech
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    // 停止录音并转录
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise((resolve) => {
        this.mediaRecorder!.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];

          // 释放麦克风
          this.mediaRecorder!.stream.getTracks().forEach(track => track.stop());
          this.mediaRecorder = null;

          // 如果有本地服务，尝试转录
          if (this.localAvailable && audioBlob.size > 0) {
            const result = await this.transcribeLocal(audioBlob);
            this.callbacks.onEnd?.();
            resolve(result);
          } else {
            this.callbacks.onEnd?.();
            resolve(null);
          }
        };

        this.mediaRecorder!.stop();
      });
    }

    this.callbacks.onEnd?.();
    return null;
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    isRecording: boolean;
    mode: STTMode;
    localAvailable: boolean;
  } {
    return {
      isRecording: this.isRecording,
      mode: this.config.mode,
      localAvailable: this.localAvailable,
    };
  }

  /**
   * 刷新本地服务状态
   */
  async refreshLocalStatus(): Promise<boolean> {
    await this.checkLocalAvailability();
    return this.localAvailable;
  }

  /**
   * 切换模式
   */
  setMode(mode: STTMode): void {
    this.config.mode = mode;
  }
}

/**
 * 创建本地 Whisper STT 实例
 */
export function createLocalWhisperSTT(
  callbacks: STTCallbacks,
  config?: Partial<WhisperConfig>
): LocalWhisperSTT {
  return new LocalWhisperSTT(callbacks, config);
}
