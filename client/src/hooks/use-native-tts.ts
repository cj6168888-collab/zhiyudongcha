import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { TTSPlugin } from '../plugins';
import type { TTSPersona, TTSExpert, TTSEmotion } from '../plugins/definitions';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('useNativeTTS');

export interface NativeTTSOptions {
  persona?: TTSPersona;
  expert?: TTSExpert;
  emotion?: TTSEmotion;
}

export interface UseNativeTTSResult {
  isAvailable: boolean;
  isSpeaking: boolean;
  speak: (text: string, options?: NativeTTSOptions) => Promise<void>;
  currentPersona: TTSPersona;
  setPersona: (persona: TTSPersona) => void;
}

export function useNativeTTS(defaultPersona: TTSPersona = 'mobile_assistant'): UseNativeTTSResult {
  const [isAvailable] = useState(() => Capacitor.isNativePlatform());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentPersona, setPersona] = useState<TTSPersona>(defaultPersona);

  // Reset isSpeaking after a generous timeout (TTSPlugin resolves immediately,
  // actual speech duration is unknown from JS side)
  const speak = useCallback(async (text: string, options?: NativeTTSOptions) => {
    if (!isAvailable || !text.trim()) return;

    const estimatedDurationMs = Math.max(1500, text.length * 80);

    setIsSpeaking(true);
    try {
      await TTSPlugin.speak({
        text,
        persona:  options?.persona  ?? currentPersona,
        expert:   options?.expert   ?? 'none',
        emotion:  options?.emotion  ?? 'normal',
      });
    } catch (err) {
      log.error('Native TTS speak failed', err);
    } finally {
      setTimeout(() => setIsSpeaking(false), estimatedDurationMs);
    }
  }, [isAvailable, currentPersona]);

  return { isAvailable, isSpeaking, speak, currentPersona, setPersona };
}
