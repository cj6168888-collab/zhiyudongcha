/**
 * Optimized TTS Playback Hook
 *
 * Features:
 * - Audio preloading and caching
 * - Streaming audio playback
 * - Low-latency playback start
 * - Audio format optimization
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useOptimizedTTS');

export interface TTSConfig {
  endpoint: string;
  preloadEnabled?: boolean;
  cacheSize?: number;
  audioFormat?: 'mp3' | 'wav' | 'ogg';
  preloadAhead?: number;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  currentText: string;
  error: string | null;
}

export interface UseOptimizedTTSReturn {
  state: TTSPlaybackState;
  speak: (request: TTSRequest) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  preload: (text: string) => void;
  clearCache: () => void;
  getCacheSize: () => number;
}

const DEFAULT_CONFIG: TTSConfig = {
  endpoint: '/ws/tts',
  preloadEnabled: true,
  cacheSize: 10,
  audioFormat: 'mp3',
  preloadAhead: 2,
};

interface CachedAudio {
  id: string;
  audioBuffer: AudioBuffer | null;
  blobUrl: string | null;
  timestamp: number;
  text: string;
}

export function useOptimizedTTS(
  config: Partial<TTSConfig> = {}
): UseOptimizedTTSReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<TTSPlaybackState>({
    isPlaying: false,
    isLoading: false,
    progress: 0,
    currentText: '',
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const cacheRef = useRef<Map<string, CachedAudio>>(new Map());
  const playbackStateRef = useRef<'idle' | 'playing' | 'paused'>('idle');
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const preloadedCountRef = useRef<number>(0);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      logger.info('[useOptimizedTTS] AudioContext initialized');
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const generateCacheKey = useCallback((request: TTSRequest): string => {
    return `${request.text}-${request.voiceId || 'default'}-${request.speed || 1}-${request.pitch || 1}`;
  }, []);

  const convertBlobToAudioBuffer = async (
    blob: Blob,
    audioContext: AudioContext
  ): Promise<AudioBuffer | null> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      logger.error('[useOptimizedTTS] Failed to decode audio:', error);
      return null;
    }
  };

  const fetchAndCacheAudio = useCallback(
    async (request: TTSRequest): Promise<CachedAudio | null> => {
      const cacheKey = generateCacheKey(request);

      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        logger.debug('[useOptimizedTTS] Cache hit:', cacheKey);
        return cached;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(mergedConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: request.text,
            voiceId: request.voiceId,
            speed: request.speed,
            pitch: request.pitch,
            format: mergedConfig.audioFormat,
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const blob = await response.blob();
        const audioContext = initAudioContext();
        const audioBuffer = await convertBlobToAudioBuffer(blob, audioContext);

        const cached: CachedAudio = {
          id: cacheKey,
          audioBuffer,
          blobUrl: audioBuffer ? null : URL.createObjectURL(blob),
          timestamp: Date.now(),
          text: request.text,
        };

        cacheRef.current.set(cacheKey, cached);

        if (cacheRef.current.size > mergedConfig.cacheSize!) {
          const oldestKey = Array.from(cacheRef.current.keys())[0];
          const oldest = cacheRef.current.get(oldestKey);
          if (oldest?.blobUrl) {
            URL.revokeObjectURL(oldest.blobUrl);
          }
          cacheRef.current.delete(oldestKey);
          logger.debug('[useOptimizedTTS] Cache overflow, removed oldest entry');
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        return cached;
      } catch (error) {
        logger.error('[useOptimizedTTS] Failed to fetch TTS:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'TTS request failed',
        }));
        return null;
      }
    },
    [generateCacheKey, mergedConfig, initAudioContext]
  );

  const preload = useCallback(
    async (text: string) => {
      if (!mergedConfig.preloadEnabled) {
        return;
      }

      if (preloadedCountRef.current >= mergedConfig.preloadAhead!) {
        logger.debug('[useOptimizedTTS] Preload limit reached');
        return;
      }

      const cached = await fetchAndCacheAudio({ text });
      if (cached) {
        preloadedCountRef.current++;
        logger.debug('[useOptimizedTTS] Preloaded:', text.substring(0, 20) + '...');
      }
    },
    [mergedConfig.preloadEnabled, mergedConfig.preloadAhead, fetchAndCacheAudio]
  );

  const playCachedAudio = useCallback(
    (cached: CachedAudio): Promise<void> => {
      return new Promise((resolve, reject) => {
        const audioContext = initAudioContext();

        if (playbackStateRef.current === 'playing') {
          stop();
        }

        let source = audioContext.createBufferSource();

        if (cached.audioBuffer) {
          source.buffer = cached.audioBuffer;
          source.connect(audioContext.destination);

          source.onended = () => {
            playbackStateRef.current = 'idle';
            setState((prev) => ({ ...prev, isPlaying: false, progress: 100 }));
            resolve();
          };

          source.start(0, pauseTimeRef.current);
          audioSourceRef.current = source;
        } else if (cached.blobUrl) {
          const audio = new Audio(cached.blobUrl);
          const mediaSource = audioContext.createMediaElementSource(audio);
          mediaSource.connect(audioContext.destination);

          audio.onended = () => {
            playbackStateRef.current = 'idle';
            setState((prev) => ({ ...prev, isPlaying: false, progress: 100 }));
            resolve();
          };

          audio.onerror = (error) => {
            logger.error('[useOptimizedTTS] Playback error:', error);
            setState((prev) => ({
              ...prev,
              isPlaying: false,
              error: 'Audio playback failed',
            }));
            reject(error);
          };

          audio.play();
          playbackStateRef.current = 'playing';
          setState((prev) => ({
            ...prev,
            isPlaying: true,
            progress: 0,
            currentText: cached.text,
            error: null,
          }));

          startTimeRef.current = audioContext.currentTime;
          audioSourceRef.current = mediaSource as unknown as AudioBufferSourceNode;
        }
        startTimeRef.current = audioContext.currentTime - pauseTimeRef.current;

        playbackStateRef.current = 'playing';
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          progress: 0,
          currentText: cached.text,
          error: null,
        }));

        audioSourceRef.current = source;

        if (source instanceof AudioBufferSourceNode) {
          source.start(0, pauseTimeRef.current);

          source.onended = () => {
            playbackStateRef.current = 'idle';
            pauseTimeRef.current = 0;
            setState((prev) => ({ ...prev, isPlaying: false, progress: 100 }));
            resolve();
          };
        }

        resolve();
      });
    },
    [initAudioContext]
  );

  const speak = useCallback(
    async (request: TTSRequest) => {
      logger.info('[useOptimizedTTS] Speaking:', request.text.substring(0, 30) + '...');

      const cached = await fetchAndCacheAudio(request);
      if (cached) {
        await playCachedAudio(cached);
      }
    },
    [fetchAndCacheAudio, playCachedAudio]
  );

  const stop = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // Ignore errors if already stopped
      }
      audioSourceRef.current = null;
    }

    playbackStateRef.current = 'idle';
    pauseTimeRef.current = 0;

    setState((prev) => ({
      ...prev,
      isPlaying: false,
      progress: 0,
    }));

    logger.debug('[useOptimizedTTS] Playback stopped');
  }, []);

  const pause = useCallback(() => {
    if (playbackStateRef.current !== 'playing') {
      return;
    }

    const audioContext = initAudioContext();
    pauseTimeRef.current = audioContext.currentTime - startTimeRef.current;

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // Ignore errors
      }
    }

    playbackStateRef.current = 'paused';

    setState((prev) => ({
      ...prev,
      isPlaying: false,
    }));

    logger.debug('[useOptimizedTTS] Playback paused');
  }, [initAudioContext]);

  const resume = useCallback(() => {
    if (playbackStateRef.current !== 'paused') {
      return;
    }

    const audioContext = initAudioContext();
    const source = audioContext.createBufferSource();

    const cached = Array.from(cacheRef.current.values()).find(
      (c) => c.text === state.currentText
    );

    if (cached?.audioBuffer) {
      source.buffer = cached.audioBuffer;
      source.connect(audioContext.destination);

      source.start(0, pauseTimeRef.current);

      source.onended = () => {
        playbackStateRef.current = 'idle';
        setState((prev) => ({ ...prev, isPlaying: false, progress: 100 }));
      };

      playbackStateRef.current = 'playing';
      startTimeRef.current = audioContext.currentTime - pauseTimeRef.current;
      audioSourceRef.current = source;

      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [initAudioContext, state.currentText]);

  const clearCache = useCallback(() => {
    cacheRef.current.forEach((cached) => {
      if (cached.blobUrl) {
        URL.revokeObjectURL(cached.blobUrl);
      }
    });
    cacheRef.current.clear();
    preloadedCountRef.current = 0;
    logger.info('[useOptimizedTTS] Cache cleared');
  }, []);

  const getCacheSize = useCallback(() => {
    return cacheRef.current.size;
  }, []);

  useEffect(() => {
    return () => {
      clearCache();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [clearCache]);

  return {
    state,
    speak,
    stop,
    pause,
    resume,
    preload,
    clearCache,
    getCacheSize,
  };
}

export default useOptimizedTTS;
