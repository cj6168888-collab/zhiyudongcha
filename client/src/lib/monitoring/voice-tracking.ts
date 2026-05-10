/**
 * Sentry Voice Error Tracking Configuration
 * 专门针对语音功能的错误分类和追踪配置
 */

// 语音错误类型分类
export const VOICE_ERROR_CATEGORIES = {
  // WebSocket连接错误
  WEBSOCKET_CONNECTION: {
    type: 'voice.websocket.connection',
    level: 'error' as const,
    tags: {
      component: 'webrtc',
      feature: 'websocket'
    }
  },

  // ASR识别错误
  ASR_RECOGNITION: {
    type: 'voice.asr.recognition',
    level: 'warning' as const,
    tags: {
      component: 'asr',
      feature: 'recognition'
    }
  },

  // TTS播放错误
  TTS_PLAYBACK: {
    type: 'voice.tts.playback',
    level: 'warning' as const,
    tags: {
      component: 'tts',
      feature: 'playback'
    }
  },

  // 麦克风权限错误
  MICROPHONE_PERMISSION: {
    type: 'voice.permission.microphone',
    level: 'error' as const,
    tags: {
      component: 'permission',
      feature: 'microphone'
    }
  },

  // 状态管理错误
  STATE_MANAGEMENT: {
    type: 'voice.state.error',
    level: 'error' as const,
    tags: {
      component: 'state',
      feature: 'management'
    }
  },

  // 音频处理错误
  AUDIO_PROCESSING: {
    type: 'voice.audio.processing',
    level: 'warning' as const,
    tags: {
      component: 'audio',
      feature: 'processing'
    }
  },

  // 打断功能错误
  INTERRUPTION: {
    type: 'voice.interruption.error',
    level: 'warning' as const,
    tags: {
      component: 'interrupt',
      feature: 'handling'
    }
  }
};

// 性能指标追踪
export const VOICE_PERFORMANCE_METRICS = {
  CONNECTION_TIME: 'voice.connection.time',
  ASR_LATENCY: 'voice.asr.latency',
  TTS_LATENCY: 'voice.tts.latency',
  E2E_LATENCY: 'voice.latency.e2e',
  AUDIO_ENERGY: 'voice.audio.energy',
  VAD_DETECTION: 'voice.vad.detection'
};

// 语音状态追踪
export const VOICE_STATE_TRANSITIONS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  INTERRUPTED: 'interrupted',
  ERROR: 'error'
};

// 错误严重级别
export const ERROR_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

// 追踪用户语音交互
export function trackVoiceInteraction(
  action: string,
  data: {
    duration?: number;
    latency?: number;
    success?: boolean;
    errorMessage?: string;
  }
) {
  if (typeof window === 'undefined') return;

  try {
    const event = {
      action,
      timestamp: Date.now(),
      ...data
    };

    // 发送到Sentry
    if ((window as any).Sentry) {
      (window as any).Sentry.captureEvent({
        type: 'transaction',
        data: event
      });
    }

    // 发送到OpenReplay
    if ((window as any).openreplay) {
      (window as any).openreplay.event('VoiceInteraction', event);
    }

  } catch (error) {
    console.error('[VoiceTracking] 追踪失败:', error);
  }
}

// 追踪语音状态变化
export function trackVoiceStateChange(
  from: string,
  to: string,
  trigger?: string
) {
  if (typeof window === 'undefined') return;

  try {
    const event = {
      type: 'voice.state.change',
      from,
      to,
      trigger,
      timestamp: Date.now()
    };

    if ((window as any).Sentry) {
      (window as any).Sentry.captureEvent({
        type: 'breadcrumb',
        data: event
      });
    }
  } catch (error) {
    console.error('[VoiceState] 追踪失败:', error);
  }
}

// 性能追踪辅助函数
export function measureVoicePerformance<T>(
  name: string,
  operation: () => Promise<T> | T
): Promise<T> | T {
  const startTime = Date.now();

  try {
    const result = operation();

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = Date.now() - startTime;
        trackVoicePerformance(name, duration);
      }) as Promise<T>;
    } else {
      const duration = Date.now() - startTime;
      trackVoicePerformance(name, duration);
      return result;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    trackVoicePerformance(name, duration, false);
    throw error;
  }
}

function trackVoicePerformance(
  name: string,
  duration: number,
  success: boolean = true
) {
  if (typeof window === 'undefined') return;

  try {
    if ((window as any).Sentry) {
      (window as any).Sentry.captureEvent({
        type: 'performance',
        data: {
          name,
          duration,
          success
        }
      });
    }

  } catch (error) {
    console.error('[VoicePerformance] 追踪失败:', error);
  }
}

// 导出类型
export type VoiceErrorCategory = keyof typeof VOICE_ERROR_CATEGORIES;
export type VoicePerformanceMetric = keyof typeof VOICE_PERFORMANCE_METRICS;
export type VoiceState = keyof typeof VOICE_STATE_TRANSITIONS;
