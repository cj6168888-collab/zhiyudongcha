import { useState, useEffect, useCallback, useRef } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { VoicePlugin } from '../plugins';
import type { SpeechResultEvent, SpeechStatusEvent, SpeechRmsEvent, SpeechErrorEvent } from '../plugins/definitions';
import { createServiceLogger } from '../lib/logger';

const VOICE_UNSUPPORTED_MESSAGE = '当前环境没有可用语音识别，可以先用文字输入。';

function normalizeVoiceError(error: unknown) {
  const rawMessage = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('not-allowed') ||
    normalized.includes('permission') ||
    normalized.includes('denied') ||
    normalized.includes('service-not-allowed')
  ) {
    return '麦克风权限被拒绝。请在浏览器或系统设置里允许麦克风，然后再点语音。';
  }

  if (normalized.includes('audio-capture')) {
    return '没有检测到可用麦克风。请检查设备麦克风后再试，或先用文字输入。';
  }

  if (normalized.includes('no-speech')) {
    return '没有听到声音，可以再点一次麦克风重新说。';
  }

  if (normalized.includes('network')) {
    return '语音识别服务连接失败，可以先用文字输入，稍后再试语音。';
  }

  if (normalized.includes('stt_not_available') || normalized.includes('not available')) {
    return VOICE_UNSUPPORTED_MESSAGE;
  }

  return rawMessage || '语音输入启动失败，可以先用文字输入。';
}

export interface UseNativeVoiceResult {
  isListening: boolean;
  transcript: string;
  partialTranscript: string;
  isSupported: boolean;
  error: string | null;
  audioLevel: number;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
}

export function useNativeVoice(): UseNativeVoiceResult {
  const [isListening, setIsListening]           = useState(false);
  const [transcript, setTranscript]             = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError]                       = useState<string | null>(null);
  const [audioLevel, setAudioLevel]             = useState(0);
  const [isSupported, setIsSupported]           = useState(false);

  const listenersRef = useRef<PluginListenerHandle[]>([]);
  const listenerRegistrationRef = useRef<Promise<void> | null>(null);
  const logRef = useRef(createServiceLogger('useNativeVoice'));

  const ensureListenerRegistration = useCallback(() => {
    if (listenerRegistrationRef.current) return listenerRegistrationRef.current;

    const handles: PluginListenerHandle[] = [];
    const registration = (async () => {
      handles.push(
        await VoicePlugin.addListener('speechResult', (ev: SpeechResultEvent) => {
          if (ev.isFinal) {
            setTranscript(ev.text);
            setPartialTranscript('');
            setIsListening(false);
          } else {
            setPartialTranscript(ev.text);
          }
        }),

        await VoicePlugin.addListener('speechStatus', (ev: SpeechStatusEvent) => {
          if (ev.status === 'listening') setIsListening(true);
          if (ev.status === 'processing') setIsListening(false);
        }),

        await VoicePlugin.addListener('speechRms', (ev: SpeechRmsEvent) => {
          // rms 范围约 -2..10 dB；归一化到 0-1
          const normalized = Math.min(1, Math.max(0, (ev.rms + 2) / 12));
          setAudioLevel(normalized);
        }),

        await VoicePlugin.addListener('speechError', (ev: SpeechErrorEvent) => {
          setIsListening(false);
          setError(normalizeVoiceError(ev.message));
          logRef.current.warn('STT error', ev);
        }),
      );

      listenersRef.current = handles;
    })();

    listenerRegistrationRef.current = registration;
    registration.catch((err) => {
      listenerRegistrationRef.current = null;
      logRef.current.error('Failed to register voice listeners', err);
    });
    return registration;
  }, []);

  // Check availability and register listeners through one plugin initialization path.
  useEffect(() => {
    let disposed = false;

    const setupVoicePlugin = async () => {
      try {
        const { available } = await VoicePlugin.isAvailable();
        if (disposed) return;
        setIsSupported(available);
        if (available) await ensureListenerRegistration();
      } catch (err) {
        if (disposed) return;
        setIsSupported(false);
        setError(normalizeVoiceError(err));
        logRef.current.error('Failed to initialize voice plugin', err);
      }
    };

    void setupVoicePlugin();

    return () => {
      disposed = true;
      listenersRef.current.forEach((h) => h.remove());
      listenersRef.current = [];
      listenerRegistrationRef.current = null;
    };
  }, [ensureListenerRegistration]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError(VOICE_UNSUPPORTED_MESSAGE);
      return;
    }
    try {
      await ensureListenerRegistration();
      setError(null);
      setTranscript('');
      setPartialTranscript('');
      await VoicePlugin.startListening();
    } catch (err) {
      setError(normalizeVoiceError(err));
      logRef.current.error('Failed to start listening', err);
    }
  }, [ensureListenerRegistration, isSupported]);

  const stopListening = useCallback(async () => {
    try {
      await VoicePlugin.stopListening();
      setIsListening(false);
    } catch (err) {
      logRef.current.error('Failed to stop listening', err);
    }
  }, []);

  return {
    isListening,
    transcript,
    partialTranscript,
    isSupported,
    error,
    audioLevel,
    startListening,
    stopListening,
  };
}
