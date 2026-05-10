/**
 * Voice Activity Detection (VAD) Hook
 * 
 * 功能：
 * 1. 持续监听麦克风
 * 2. 检测用户是否在说话（VAD）
 * 3. 自动开始/结束语音识别
 * 4. 与唤醒词系统集成
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'processing' | 'responding';

export interface VADConfig {
  /** 音量阈值 (0-1)，超过此值认为在说话 */
  volumeThreshold: number;
  /** 静音超时时间(ms)，超过此时间认为说话结束 */
  silenceTimeout: number;
  /** 最小说话时间(ms)，低于此时间忽略 */
  minSpeechDuration: number;
  /** 语言设置 */
  language: string;
  /** 是否启用唤醒词检测 */
  enableWakeWord: boolean;
  /** 用户ID */
  userId?: string;
  /** Barge-in打断阈值 (0-1)，TTS播放时超过此音量触发打断 */
  bargeInThreshold: number;
  /** 是否启用Barge-in打断功能 */
  enableBargeIn: boolean;
}

const DEFAULT_CONFIG: VADConfig = {
  volumeThreshold: 0.02,
  silenceTimeout: 1500,
  minSpeechDuration: 300,
  language: 'zh-CN',
  enableWakeWord: true,
  userId: 'default',
  bargeInThreshold: 0.15,  // 比正常说话阈值高，需要用户大声说话才能打断
  enableBargeIn: true,
};

export interface UseVoiceActivityReturn {
  /** 当前语音状态 */
  voiceState: VoiceState;
  /** 是否正在监听 */
  isListening: boolean;
  /** 当前音量级别 (0-1) */
  volumeLevel: number;
  /** 最后识别的文本 */
  transcript: string;
  /** 临时识别结果 */
  interimTranscript: string;
  /** 是否检测到唤醒词 */
  wakeWordDetected: boolean;
  /** 开始持续监听 */
  startListening: () => Promise<void>;
  /** 停止监听 */
  stopListening: () => void;
  /** 暂时静音（不停止监听） */
  mute: () => void;
  /** 取消静音 */
  unmute: () => void;
  /** 是否静音 */
  isMuted: boolean;
  /** 错误信息 */
  error: string | null;
  /** 设置voiceState（外部TTS控制用） */
  setVoiceState: (state: VoiceState) => void;
}

export function useVoiceActivity(
  onSpeechEnd: (transcript: string, wakeWordDetected: boolean) => void,
  config: Partial<VADConfig> = {},
  onBargeIn?: () => void
): UseVoiceActivityReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const accumulatedTranscriptRef = useRef<string>('');
  const lastLogTimeRef = useRef<number>(0);
  const DEBUG_AUDIO = false;

  const checkWakeWord = useCallback(async (text: string): Promise<boolean> => {
    if (!mergedConfig.enableWakeWord) return true;
    
    try {
      const response = await fetch('/api/wake/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          userId: mergedConfig.userId,
        }),
      });
      const data = await response.json();
      return data.detected;
    } catch {
      return false;
    }
  }, [mergedConfig.enableWakeWord, mergedConfig.userId]);

  const resetSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    
    silenceTimeoutRef.current = setTimeout(() => {
      const speechDuration = Date.now() - speechStartTimeRef.current;
      
      if (speechDuration >= mergedConfig.minSpeechDuration && accumulatedTranscriptRef.current.trim()) {
        const finalTranscript = accumulatedTranscriptRef.current.trim();
        setTranscript(finalTranscript);
        setVoiceState('processing');
        
        checkWakeWord(finalTranscript).then(detected => {
          setWakeWordDetected(detected);
          onSpeechEnd(finalTranscript, detected);
          
          accumulatedTranscriptRef.current = '';
          setInterimTranscript('');
          
          setTimeout(() => {
            if (isListening && !isMuted) {
              setVoiceState('listening');
            }
          }, 500);
        });
      } else {
        accumulatedTranscriptRef.current = '';
        setInterimTranscript('');
        if (isListening && !isMuted) {
          setVoiceState('listening');
        }
      }
    }, mergedConfig.silenceTimeout);
  }, [mergedConfig.silenceTimeout, mergedConfig.minSpeechDuration, onSpeechEnd, checkWakeWord, isListening, isMuted]);

  const analyzeVolume = useCallback(() => {
    if (!analyserRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
      if (dataArray[i] > peak) peak = dataArray[i];
    }
    const average = sum / dataArray.length / 255;
    const peakNormalized = peak / 255;
    
    setVolumeLevel(average);

    // ===== 回声消除 + Barge-in核心逻辑 =====
    // 当小智正在说话(responding/processing)时：
    // 1. 正常情况丢弃麦克风数据（防止回声）
    // 2. 如果用户大声说话（超过bargeInThreshold），触发打断
    if (voiceState === 'responding' || voiceState === 'processing') {
      // Barge-in检测：用户大声说话可以打断TTS
      if (mergedConfig.enableBargeIn && average > mergedConfig.bargeInThreshold) {
        console.log(`[VAD] Barge-in detected! Volume: ${(average * 100).toFixed(1)}% > ${(mergedConfig.bargeInThreshold * 100).toFixed(1)}%`);
        setVoiceState('listening');
        onBargeIn?.();
      }
      // 否则丢弃麦克风数据
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      return;
    }
    
    if (isMuted) {
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      return;
    }

    const now = Date.now();
    if (DEBUG_AUDIO && now - lastLogTimeRef.current >= 100) {
      lastLogTimeRef.current = now;
      const decibelValue = average > 0 ? 20 * Math.log10(average) : -Infinity;
      const peakDecibel = peakNormalized > 0 ? 20 * Math.log10(peakNormalized) : -Infinity;
      console.log(
        `[MIC_REALTIME] 振幅: ${(average * 100).toFixed(2)}% | ` +
        `峰值: ${(peakNormalized * 100).toFixed(2)}% | ` +
        `分贝(RMS): ${decibelValue.toFixed(1)}dB | ` +
        `分贝(Peak): ${peakDecibel.toFixed(1)}dB | ` +
        `阈值: ${(mergedConfig.volumeThreshold * 100).toFixed(1)}% | ` +
        `状态: ${voiceState}`
      );
    }

    if (average > mergedConfig.volumeThreshold) {
      if (voiceState === 'listening') {
        setVoiceState('speaking');
        speechStartTimeRef.current = Date.now();
      }
      resetSilenceTimeout();
    }

    animationFrameRef.current = requestAnimationFrame(analyzeVolume);
  }, [mergedConfig.volumeThreshold, mergedConfig.bargeInThreshold, mergedConfig.enableBargeIn, voiceState, resetSilenceTimeout, isMuted, onBargeIn]);

  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('浏览器不支持语音识别');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = mergedConfig.language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      
      if (final) {
        accumulatedTranscriptRef.current += final;
        setTranscript(accumulatedTranscriptRef.current);
      }
      
      setInterimTranscript(interim);
      
      if (final || interim) {
        setVoiceState('speaking');
        resetSilenceTimeout();
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        return;
      }
      if (event.error === 'aborted') {
        return;
      }
      console.error('[VAD] Recognition error:', event.error);
      setError(`语音识别错误: ${event.error}`);
    };

    recognition.onend = () => {
      if (isListening && !isMuted) {
        try {
          recognition.start();
        } catch (e) {
          console.error('[VAD] Failed to restart recognition:', e);
        }
      }
    };

    return recognition;
  }, [mergedConfig.language, resetSilenceTimeout, isListening, isMuted]);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      recognitionRef.current = initSpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setIsListening(true);
      setVoiceState('listening');

      animationFrameRef.current = requestAnimationFrame(analyzeVolume);

    } catch (err) {
      console.error('[VAD] Failed to start listening:', err);
      setError('无法访问麦克风，请检查权限设置');
    }
  }, [initSpeechRecognition, analyzeVolume]);

  const stopListening = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    setVoiceState('idle');
    setVolumeLevel(0);
    accumulatedTranscriptRef.current = '';
    setInterimTranscript('');
  }, []);

  const mute = useCallback(() => {
    setIsMuted(true);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('[VAD] Failed to restart after unmute:', e);
      }
    }
    setVoiceState('listening');
  }, [isListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    voiceState,
    isListening,
    volumeLevel,
    transcript,
    interimTranscript,
    wakeWordDetected,
    startListening,
    stopListening,
    mute,
    unmute,
    isMuted,
    error,
    setVoiceState,
  };
}
