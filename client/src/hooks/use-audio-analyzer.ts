/**
 * Audio Analyzer Hook - 专门用于录音分析功能
 *
 * 功能：
 * 1. 独立的音频录制和分析
 * 2. 不与实时语音对话混合（通过voiceStateManager互斥）
 * 3. 支持环境音分析、声纹录入等
 * 4. 完全独立于对话系统
 */

import { useState, useRef, useCallback } from 'react';
import { voiceStateManager } from '../lib/voice/voice-state-manager';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useAudioAnalyzer');

export interface AudioAnalysisConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioAnalysisResult {
  audioData: Float32Array;
  duration: number;
  sampleRate: number;
  energy: number;
  peak: number;
  rms: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  dominantFrequency: number;
}

export interface UseAudioAnalyzerReturn {
  isRecording: boolean;
  isAnalyzing: boolean;
  duration: number;
  progress: number;
  energy: number;
  peak: number;
  result: AudioAnalysisResult | null;
  error: string | null;
  startRecording: (config?: AudioAnalysisConfig) => Promise<void>;
  stopRecording: () => Promise<AudioAnalysisResult | null>;
  cancelRecording: () => void;
  reset: () => void;
}

const DEFAULT_CONFIG: AudioAnalysisConfig = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export function useAudioAnalyzer(
  onAnalysisComplete?: (result: AudioAnalysisResult) => void,
  onProgress?: (progress: number, energy: number, peak: number) => void
): UseAudioAnalyzerReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [peak, setPeak] = useState(0);
  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const analyzeAudio = useCallback((audioData: Float32Array, sampleRate: number): AudioAnalysisResult => {
    if (audioData.length === 0) {
      return {
        audioData,
        duration: 0,
        sampleRate,
        energy: 0,
        peak: 0,
        rms: 0,
        zeroCrossingRate: 0,
        spectralCentroid: 0,
        dominantFrequency: 0,
      };
    }

    // 基础分析
    let sum = 0;
    let peakValue = 0;
    let zeroCrossings = 0;
    const lastSample = audioData[0];

    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.abs(audioData[i]);
      sum += sample * sample;
      if (sample > peakValue) peakValue = sample;

      // 过零率计算
      if (i > 0 && ((audioData[i] >= 0) !== (audioData[i - 1] >= 0))) {
        zeroCrossings++;
      }
    }

    const rms = Math.sqrt(sum / audioData.length);
    const duration = audioData.length / sampleRate;
    const zeroCrossingRate = zeroCrossings / audioData.length;

    // 频谱分析（简化版）
    const spectralCentroid = calculateSpectralCentroid(audioData);
    const dominantFrequency = calculateDominantFrequency(audioData, sampleRate);

    return {
      audioData,
      duration,
      sampleRate,
      energy: rms,
      peak: peakValue,
      rms,
      zeroCrossingRate,
      spectralCentroid,
      dominantFrequency,
    };
  }, []);

  const calculateSpectralCentroid = (audioData: Float32Array): number => {
    // 简化的频谱重心计算
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < audioData.length; i++) {
      const magnitude = Math.abs(audioData[i]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  };

  const calculateDominantFrequency = (audioData: Float32Array, sampleRate: number): number => {
    // 简化的主频率计算
    const nyquist = sampleRate / 2;
    const binSize = nyquist / audioData.length;

    let maxMagnitude = 0;
    let dominantBin = 0;

    for (let i = 1; i < audioData.length / 2; i++) {
      const magnitude = Math.abs(audioData[i]);
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
        dominantBin = i;
      }
    }

    return dominantBin * binSize;
  };

  const updateAnalysis = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
      if (dataArray[i] > peak) peak = dataArray[i];
    }

    const average = sum / bufferLength / 255;
    const peakNorm = peak / 255;

    setEnergy(average);
    setPeak(peakNorm);

    // 更新进度
    const currentDuration = (Date.now() - startTimeRef.current) / 1000;
    setDuration(currentDuration);

    onProgress?.(currentDuration, average, peakNorm);

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAnalysis);
    }
  }, [isRecording, onProgress]);

  const startRecording = useCallback(async (config: AudioAnalysisConfig = {}) => {
    const canRecord = voiceStateManager.canStartRecording();
    if (!canRecord.allowed) {
      logger.warn(`[AudioAnalyzer] 无法开始录音: ${canRecord.reason}`);
      setError(canRecord.reason || '无法开始录音');
      return;
    }

    voiceStateManager.transition('START_RECORDING', '开始录音分析');

    try {
      setError(null);
      setResult(null);
      audioBufferRef.current = [];

      const mergedConfig = { ...DEFAULT_CONFIG, ...config };

      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: mergedConfig.sampleRate,
          channelCount: mergedConfig.channelCount,
          echoCancellation: mergedConfig.echoCancellation,
          noiseSuppression: mergedConfig.noiseSuppression,
          autoGainControl: mergedConfig.autoGainControl,
        },
      });

      mediaStreamRef.current = stream;

      // 创建音频上下文
      const audioContext = new AudioContext({ sampleRate: mergedConfig.sampleRate });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // 创建音频处理器
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isRecording) {
          const inputData = e.inputBuffer.getChannelData(0);
          audioBufferRef.current.push(new Float32Array(inputData));
        }
      };

      // 连接音频节点
      source.connect(analyser);
      analyser.connect(processor);
      // 不连接到 destination，避免播放录音

      setIsRecording(true);
      setDuration(0);
      setProgress(0);
      setEnergy(0);
      setPeak(0);
      startTimeRef.current = Date.now();

      // 开始实时分析
      updateAnalysis();

      // 模拟进度更新
      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        // 可以设置最大录制时长
        const maxDuration = 30; // 30秒
        const progress = Math.min((elapsed / maxDuration) * 100, 100);
        setProgress(progress);

        if (progress >= 100) {
          stopRecording();
        }
      }, 100);

    } catch (error) {
      console.error('[AudioAnalyzer] Recording error:', error);
      setError(error instanceof Error ? error.message : '无法访问麦克风');
    }
  }, [isRecording, updateAnalysis]);

  const stopRecording = useCallback(async (): Promise<AudioAnalysisResult | null> => {
    if (!isRecording) return null;

    setIsRecording(false);
    setIsAnalyzing(true);

    voiceStateManager.transition('STOP_RECORDING', '停止录音分析');

    // 清理定时器
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    try {
      // 合并音频缓冲区
      const totalLength = audioBufferRef.current.reduce((sum, buffer) => sum + buffer.length, 0);
      const mergedAudio = new Float32Array(totalLength);
      let offset = 0;

      for (const buffer of audioBufferRef.current) {
        mergedAudio.set(buffer, offset);
        offset += buffer.length;
      }

      const sampleRate = audioContextRef.current?.sampleRate || 16000;
      const analysisResult = analyzeAudio(mergedAudio, sampleRate);

      setResult(analysisResult);
      onAnalysisComplete?.(analysisResult);

      setIsAnalyzing(false);
      return analysisResult;

    } catch (error) {
      console.error('[AudioAnalyzer] Analysis error:', error);
      setError(error instanceof Error ? error.message : '音频分析失败');
      setIsAnalyzing(false);
      return null;
    } finally {
      // 清理资源
      cleanup();
    }
  }, [isRecording, analyzeAudio, onAnalysisComplete]);

  const cancelRecording = useCallback(() => {
    if (!isRecording) return;

    setIsRecording(false);
    setProgress(0);
    setDuration(0);
    setEnergy(0);
    setPeak(0);
    audioBufferRef.current = [];

    voiceStateManager.transition('RESET', '取消录音');

    // 清理定时器
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    cleanup();
  }, [isRecording]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
    setDuration(0);
    setEnergy(0);
    setPeak(0);
    audioBufferRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  return {
    isRecording,
    isAnalyzing,
    duration,
    progress,
    energy,
    peak,
    result,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
