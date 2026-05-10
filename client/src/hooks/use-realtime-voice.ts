/**
 * Realtime Voice Hook - 连接后端实时语音服务
 *
 * 功能：
 * 1. WebSocket连接后端语音服务
 * 2. 音频录制和发送
 * 3. 接收ASR识别结果
 * 4. 接收TTS音频并播放
 * 5. 支持打断功能
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceStateManager, subscribeVoiceState, VoiceMode } from '../lib/voice/voice-state-manager';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useRealtimeVoice');

export type RealtimeVoiceState =
  | 'disconnected'
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface RealtimeVoiceConfig {
  userId: string;
  voiceId?: string;
  autoConnect?: boolean;
  autoReconnect?: boolean;
}

export interface UseRealtimeVoiceReturn {
  state: RealtimeVoiceState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  interrupt: () => void;
  sendTextMessage: (text: string) => void;
}

const DEFAULT_CONFIG: RealtimeVoiceConfig = {
  userId: 'default',
  voiceId: 'longhuhu_v3',
  autoConnect: false,
  autoReconnect: true,
};

export function useRealtimeVoice(
  onAssistantResponse?: (text: string) => void,
  onTranscript?: (text: string, isFinal: boolean) => void,
  config: Partial<RealtimeVoiceConfig> = {}
): UseRealtimeVoiceReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<RealtimeVoiceState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isSystemSpeakingRef = useRef(false);
  const lastSystemAudioTime = useRef(0);

  // 添加回声检测方法
  const calculateAudioEnergy = (audioData: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  };

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/realtime-voice`;
  }, []);

  const playNextAudio = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBase64 = audioQueueRef.current.shift();

    if (!audioBase64) {
      isPlayingRef.current = false;
      return;
    }

    try {
      const audioData = atob(audioBase64);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        playNextAudio();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        playNextAudio();
      };

      await audio.play();
    } catch (err) {
      console.error('[RealtimeVoice] Audio playback error:', err);
      playNextAudio();
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'session_created':
          setState('idle');
          break;

        case 'state_change':
          setState(data.newState as RealtimeVoiceState);

          const modeMap: Record<RealtimeVoiceState, VoiceMode> = {
            'idle': 'IDLE',
            'listening': 'LISTENING',
            'processing': 'PROCESSING',
            'speaking': 'SPEAKING',
            'interrupted': 'INTERRUPTED',
            'disconnected': 'IDLE',
            'connecting': 'IDLE',
            'error': 'IDLE',
          };

          const newMode = modeMap[data.newState as RealtimeVoiceState];
          if (newMode) {
            const canSwitch = voiceStateManager.canSwitchTo(newMode);
            if (canSwitch.allowed) {
              const eventMap: Record<RealtimeVoiceState, 'START_LISTENING' | 'START_PROCESSING' | 'START_SPEAKING' | 'STOP_LISTENING' | 'STOP_SPEAKING' | 'STOP_PROCESSING' | 'RESET'> = {
                'listening': 'START_LISTENING',
                'processing': 'START_PROCESSING',
                'speaking': 'START_SPEAKING',
                'idle': 'STOP_LISTENING',
                'disconnected': 'RESET',
                'interrupted': 'RESET',
                'connecting': 'RESET',
                'error': 'RESET',
              };
              const event = eventMap[data.newState as RealtimeVoiceState];
              if (event) {
                voiceStateManager.transition(event, `服务器状态变更: ${data.oldState} -> ${data.newState}`);
              }
            }
          }
          break;

        case 'asr_started':
          break;

        case 'transcript':
          if (data.isFinal) {
            setTranscript(data.text);
            setInterimTranscript('');
            onTranscript?.(data.text, true);
          } else {
            setInterimTranscript(data.text);
            onTranscript?.(data.text, false);
          }
          break;

        case 'processing':
          voiceStateManager.transition('START_PROCESSING', '开始处理用户语音');
          break;

        case 'tts_chunk':
          if (data.audioBase64) {
            isSystemSpeakingRef.current = true;

            if (!voiceStateManager.isInConversation()) {
              voiceStateManager.transition('START_SPEAKING', '开始播放AI回复');
            }

            audioQueueRef.current.push(data.audioBase64);
            if (!isPlayingRef.current) {
              playNextAudio();
            }
          }
          if (data.isFinal) {
            onAssistantResponse?.(data.textSegment || '');
          }
          break;

        case 'tts_complete':
          isSystemSpeakingRef.current = false;
          lastSystemAudioTime.current = Date.now();

          voiceStateManager.transition('STOP_SPEAKING', 'AI回复播放完成');
          break;

        case 'interrupted':
          audioQueueRef.current = [];
          break;

        case 'error':
          console.error('[RealtimeVoice] Error:', data.message);
          setError(data.message);
          break;

        case 'vad_status':
          break;

        default:
      }
    } catch (err) {
      console.error('[RealtimeVoice] Message parse error:', err);
    }
  }, [onAssistantResponse, onTranscript, playNextAudio]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState('connecting');
    setError(null);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        ws.send(JSON.stringify({
          type: 'create_session',
          userId: mergedConfig.userId,
          voiceId: mergedConfig.voiceId,
        }));
      };

      ws.onmessage = handleMessage;

      ws.onerror = (err) => {
        console.error('[RealtimeVoice] WebSocket error:', err);
        setError('连接错误');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setState('disconnected');
        wsRef.current = null;

        if (mergedConfig.autoReconnect && reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('[RealtimeVoice] Connection error:', err);
      setError('无法连接到语音服务');
      setState('error');
    }
  }, [getWebSocketUrl, handleMessage, mergedConfig.userId, mergedConfig.voiceId, mergedConfig.autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setState('disconnected');
    audioQueueRef.current = [];

    voiceStateManager.reset('WebSocket断开连接');
  }, []);

  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('未连接到语音服务');
      return;
    }

    const canStart = voiceStateManager.canSwitchTo('LISTENING');
    if (!canStart.allowed) {
      logger.warn(`[useRealtimeVoice] 无法开始监听: ${canStart.reason}`);
      setError(canStart.reason || '无法开始监听');
      return;
    }

    voiceStateManager.transition('START_LISTENING', '用户开始监听');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);

          // 添加回声检测和过滤
          const energy = calculateAudioEnergy(inputData);

          // 如果系统正在说话，跳过所有音频输入
          if (isSystemSpeakingRef.current) {
            return;
          }

          // 如果刚播放完系统音频，延迟一段时间再接收输入
          const timeSinceLastAudio = Date.now() - lastSystemAudioTime.current;
          if (timeSinceLastAudio < 500) { // 500ms延迟
            return;
          }

          // 如果能量过高，可能是回声，跳过发送
          if (energy > 0.8) {
            return;
          }

          const pcmData = new Int16Array(inputData.length);

          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          wsRef.current.send(pcmData.buffer);
        }
      };

      // 关键修复：不要连接到音频输出，防止回声
      // source.connect(processor);
      // processor.connect(audioContext.destination);

      // 使用音频分析器而不是直接输出
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.connect(processor);
      // 不连接到 destination，防止扬声器回声

      wsRef.current.send(JSON.stringify({ type: 'start_listening' }));
      setState('listening');

    } catch (err) {
      console.error('[RealtimeVoice] Microphone error:', err);
      setError('无法访问麦克风');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_listening' }));
    }

    voiceStateManager.transition('STOP_LISTENING', '用户停止监听');
    setState('idle');
  }, []);

  const interrupt = useCallback(() => {
    audioQueueRef.current = [];

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }

    voiceStateManager.transition('INTERRUPT', '用户打断');
    voiceStateManager.incrementInterruptCount();
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text_message',
        text,
      }));
    }
  }, []);

  useEffect(() => {
    if (mergedConfig.autoConnect) {
      connect();
    }

    const unsubscribe = subscribeVoiceState((state, event) => {
      logger.info(`[useRealtimeVoice] 语音状态变更: ${event}`, state);
    }, (mode) => {
      logger.info(`[useRealtimeVoice] 语音模式变更: ${mode}`);
    });

    return () => {
      unsubscribe();
      disconnect();
    };
  }, []);

  return {
    state,
    isConnected,
    isListening: state === 'listening',
    isSpeaking: state === 'speaking',
    transcript,
    interimTranscript,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    interrupt,
    sendTextMessage,
  };
}
