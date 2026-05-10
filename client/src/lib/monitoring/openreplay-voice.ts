/**
 * OpenReplay Session Replay Configuration
 * 专门针对语音交互的会话回放配置
 */

// OpenReplay配置选项
export interface OpenReplayConfig {
  projectKey: string;
  ingestPoint?: string;
  verbose?: boolean;
  catchErrors?: boolean;
  mutationRateLimiter?: {
    rate: number;
    bucketSize: number;
  };
  recording: {
    dom?: boolean;
    network?: boolean;
    console?: boolean;
    errors?: boolean;
    clicks?: boolean;
    scrolls?: boolean;
    touches?: boolean;
    forms?: boolean;
    inputs?: boolean;
  };
}

// 语音交互追踪配置
export interface VoiceTrackingConfig {
  trackASR: boolean;
  trackTTS: boolean;
  trackVAD: boolean;
  trackWebSocket: boolean;
  trackStateChanges: boolean;
  sensitiveAudio: boolean;
}

// 默认配置
export const DEFAULT_OPENREPLAY_CONFIG: OpenReplayConfig = {
  projectKey: typeof process !== 'undefined' && process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY 
    ? process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY 
    : '',
  ingestPoint: 'https://ingest.openreplay.com',
  verbose: true,
  catchErrors: true,
  mutationRateLimiter: {
    rate: 100,
    bucketSize: 1000
  },
  recording: {
    dom: true,
    network: true,
    console: true,
    errors: true,
    clicks: true,
    scrolls: true,
    touches: true,
    forms: true,
    inputs: true
  }
};

export const DEFAULT_VOICE_TRACKING_CONFIG: VoiceTrackingConfig = {
  trackASR: true,
  trackTTS: true,
  trackVAD: true,
  trackWebSocket: true,
  trackStateChanges: true,
  sensitiveAudio: false // 出于隐私考虑，默认不录制音频
};

// 语音事件类型
export const VOICE_EVENTS = {
  // 连接事件
  WS_CONNECTING: 'voice:ws:connecting',
  WS_CONNECTED: 'voice:ws:connected',
  WS_DISCONNECTED: 'voice:ws:disconnected',
  WS_ERROR: 'voice:ws:error',
  
  // ASR事件
  ASR_START: 'voice:asr:start',
  ASR_RESULT: 'voice:asr:result',
  ASR_FINAL: 'voice:asr:final',
  ASR_ERROR: 'voice:asr:error',
  
  // TTS事件
  TTS_START: 'voice:tts:start',
  TTS_PLAYING: 'voice:tts:playing',
  TTS_COMPLETE: 'voice:tts:complete',
  TTS_ERROR: 'voice:tts:error',
  
  // VAD事件
  VAD_SPEECH_START: 'voice:vad:speech:start',
  VAD_SPEECH_END: 'voice:vad:speech:end',
  VAD_SILENCE: 'voice:vad:silence',
  
  // 状态事件
  STATE_CHANGE: 'voice:state:change',
  INTERRUPT: 'voice:interrupt',
  RESUME: 'voice:resume',
  
  // 性能事件
  LATENCY_MEASUREMENT: 'voice:latency:measurement',
  PERFORMANCE: 'voice:performance'
} as const;

// 创建语音事件追踪器
export function createVoiceEventTracker(openreplay: any) {
  return {
    // 追踪WebSocket连接
    trackWebSocket: (event: string, data: Record<string, unknown>) => {
      if (!openreplay) return;
      try {
        openreplay.event(VOICE_EVENTS.WS_CONNECTING, {
          type: event,
          timestamp: Date.now(),
          ...data
        });
      } catch (error) {
        console.error('[OpenReplay] WebSocket追踪失败:', error);
      }
    },

    // 追踪ASR事件
    trackASR: (event: string, data: {
      transcript?: string;
      confidence?: number;
      latency?: number;
    }) => {
      if (!openreplay) return;
      try {
        openreplay.event(VOICE_EVENTS.ASR_START, {
          type: event,
          timestamp: Date.now(),
          ...data
        });
      } catch (error) {
        console.error('[OpenReplay] ASR追踪失败:', error);
      }
    },

    // 追踪TTS事件
    trackTTS: (event: string, data: {
      text?: string;
      duration?: number;
      latency?: number;
    }) => {
      if (!openreplay) return;
      try {
        openreplay.event(VOICE_EVENTS.TTS_START, {
          type: event,
          timestamp: Date.now(),
          ...data
        });
      } catch (error) {
        console.error('[OpenReplay] TTS追踪失败:', error);
      }
    },

    // 追踪VAD事件
    trackVAD: (event: string, data: {
      energy?: number;
      duration?: number;
    }) => {
      if (!openreplay) return;
      try {
        openreplay.event(VOICE_EVENTS.VAD_SPEECH_START, {
          type: event,
          timestamp: Date.now(),
          ...data
        });
      } catch (error) {
        console.error('[OpenReplay] VAD追踪失败:', error);
      }
    },

    // 追踪状态变化
    trackStateChange: (from: string, to: string, trigger?: string) => {
      if (!openreplay) return;
      try {
        openreplay.event(VOICE_EVENTS.STATE_CHANGE, {
          from,
          to,
          trigger,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('[OpenReplay] 状态追踪失败:', error);
      }
    },

    // 追踪性能指标
    trackPerformance: (metric: string, value: number, tags?: Record<string, string>) => {
      if (!openreplay) return;
      try {
        openreplay.event(VOICE_EVENTS.PERFORMANCE, {
          metric,
          value,
          tags,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('[OpenReplay] 性能追踪失败:', error);
      }
    }
  };
}

// 用户会话元数据
export interface SessionMetadata {
  userId?: string;
  userType?: 'guest' | 'registered' | 'premium';
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  voiceEnabled?: boolean;
  asrProvider?: string;
  ttsProvider?: string;
}

// 设置会话元数据
export function setSessionMetadata(openreplay: any, metadata: SessionMetadata) {
  if (!openreplay) return;
  try {
    if (openreplay.setMetadata) {
      openreplay.setMetadata(metadata);
    }
    if (openreplay.setUserID) {
      if (metadata.userId) {
        openreplay.setUserID(metadata.userId);
      }
    }
  } catch (error) {
    console.error('[OpenReplay] 设置元数据失败:', error);
  }
}

// 导出类型
export type VoiceEventType = typeof VOICE_EVENTS[keyof typeof VOICE_EVENTS];
