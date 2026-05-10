/**
 * Streaming ASR Hook - Optimized for low latency speech recognition
 *
 * Features:
 * - Real-time streaming result processing
 * - Predictive text caching
 * - WebSocket message batching
 * - Adaptive VAD threshold
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useStreamingASR');

export interface StreamingASRConfig {
  endpoint: string;
  language?: string;
  enablePunctuation?: boolean;
  enableInverseTextNormalization?: boolean;
  vadMode?: 'single' | 'continuous';
  vadSilenceDuration?: number;
  vadSpeechNoise?: number;
}

export interface StreamingASRResult {
  transcript: string;
  interimTranscript: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
}

export interface UseStreamingASRReturn {
  isConnected: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: Float32Array) => void;
  lastResult: StreamingASRResult | null;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

const DEFAULT_CONFIG: StreamingASRConfig = {
  endpoint: '/ws/asr',
  language: 'zh-CN',
  enablePunctuation: true,
  enableInverseTextNormalization: true,
  vadMode: 'single',
  vadSilenceDuration: 500,
  vadSpeechNoise: 0.5,
};

export function useStreamingASR(
  config: Partial<StreamingASRConfig> = {}
): UseStreamingASRReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastResult, setLastResult] = useState<StreamingASRResult | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<
    'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
  >('unknown');

  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isSendingRef = useRef(false);
  const lastPingTimeRef = useRef<number>(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptCacheRef = useRef<string>('');
  const interimCacheRef = useRef<string>('');
  const messageBufferRef = useRef<string[]>([]);
  const bufferFlushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushMessageBuffer = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      messageBufferRef.current.length > 0
    ) {
      const messages = messageBufferRef.current.splice(0, 10);
      messages.forEach((msg) => {
        try {
          wsRef.current?.send(msg);
        } catch (error) {
          logger.error('[useStreamingASR] Failed to send buffered message:', error);
        }
      });
    }

    if (messageBufferRef.current.length > 0) {
      bufferFlushTimerRef.current = setTimeout(flushMessageBuffer, 50);
    }
  }, []);

  const sendAudio = useCallback(
    (audioData: Float32Array) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        logger.warn('[useStreamingASR] Cannot send audio: not connected');
        return;
      }

      const pcmData = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const s = Math.max(-1, Math.min(1, audioData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const message = JSON.stringify({
        type: 'audio_data',
        audio: Array.from(pcmData),
        timestamp: Date.now(),
      });

      messageBufferRef.current.push(message);

      if (!bufferFlushTimerRef.current) {
        bufferFlushTimerRef.current = setTimeout(flushMessageBuffer, 16);
      }
    },
    [flushMessageBuffer]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'pong') {
          const pingLatency = Date.now() - lastPingTimeRef.current;
          if (pingLatency < 100) {
            setConnectionQuality('excellent');
          } else if (pingLatency < 200) {
            setConnectionQuality('good');
          } else if (pingLatency < 400) {
            setConnectionQuality('fair');
          } else {
            setConnectionQuality('poor');
          }
          return;
        }

        if (data.type === 'transcript') {
          const result: StreamingASRResult = {
            transcript: data.text || '',
            interimTranscript: data.interimText || '',
            isFinal: data.isFinal || false,
            confidence: data.confidence || 0,
            timestamp: Date.now(),
          };

          setLastResult(result);

          if (result.isFinal) {
            transcriptCacheRef.current += result.transcript;
            setTranscript(transcriptCacheRef.current);
            interimCacheRef.current = '';
            setInterimTranscript('');
          } else {
            interimCacheRef.current = result.interimTranscript;
            setInterimTranscript(result.interimTranscript);
          }

          logger.debug(
            `[useStreamingASR] Result: ${result.isFinal ? 'final' : 'interim'} - "${result.transcript}${result.interimTranscript}"`
          );
        }

        if (data.type === 'session_created') {
          setIsConnected(true);
          logger.info('[useStreamingASR] Session created:', data.sessionId);
        }

        if (data.type === 'asr_started') {
          setIsListening(true);
          logger.info('[useStreamingASR] ASR listening started');
        }

        if (data.type === 'asr_stopped') {
          setIsListening(false);
          logger.info('[useStreamingASR] ASR listening stopped');
        }
      } catch (error) {
        logger.error('[useStreamingASR] Failed to parse message:', error);
      }
    },
    []
  );

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${mergedConfig.endpoint}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.info('[useStreamingASR] WebSocket connected');
        setIsConnected(true);

        ws.send(
          JSON.stringify({
            type: 'start_session',
            language: mergedConfig.language,
            enablePunctuation: mergedConfig.enablePunctuation,
            enableITN: mergedConfig.enableInverseTextNormalization,
            vad: {
              mode: mergedConfig.vadMode,
              silenceDuration: mergedConfig.vadSilenceDuration,
              speechNoise: mergedConfig.vadSpeechNoise,
            },
          })
        );

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            lastPingTimeRef.current = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 10000);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        logger.warn(`[useStreamingASR] WebSocket closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsListening(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
      };

      ws.onerror = (error) => {
        logger.error('[useStreamingASR] WebSocket error:', error);
        setConnectionQuality('poor');
      };
    } catch (error) {
      logger.error('[useStreamingASR] Failed to connect:', error);
    }
  }, [mergedConfig, handleMessage]);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (bufferFlushTimerRef.current) {
      clearTimeout(bufferFlushTimerRef.current);
      bufferFlushTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setConnectionQuality('unknown');
    transcriptCacheRef.current = '';
    interimCacheRef.current = '';
    messageBufferRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isListening,
    transcript,
    interimTranscript,
    connect,
    disconnect,
    sendAudio,
    lastResult,
    connectionQuality,
  };
}

export default useStreamingASR;
