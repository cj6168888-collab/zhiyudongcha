import { useState, useEffect, useCallback, useRef } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { VoicePlugin } from '../plugins';
import type { SpeechResultEvent, SpeechStatusEvent, SpeechRmsEvent, SpeechErrorEvent } from '../plugins/definitions';
import { createServiceLogger } from '../lib/logger';

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
          setError(ev.message);
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

  // Check availability once on mount
  useEffect(() => {
    VoicePlugin.isAvailable()
      .then(({ available }) => setIsSupported(available))
      .catch(() => setIsSupported(false));
  }, []);

  // Register Capacitor event listeners (unified event schema for web + native)
  useEffect(() => {
    ensureListenerRegistration();

    return () => {
      listenersRef.current.forEach((h) => h.remove());
      listenersRef.current = [];
      listenerRegistrationRef.current = null;
    };
  }, [ensureListenerRegistration]);

  const startListening = useCallback(async () => {
    if (!isSupported) return;
    try {
      await ensureListenerRegistration();
      setError(null);
      setTranscript('');
      setPartialTranscript('');
      await VoicePlugin.startListening();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
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
