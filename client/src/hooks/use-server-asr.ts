/**
 * Server-side ASR (Automatic Speech Recognition) Hook
 * 
 * 使用后端 DashScope 语音识别服务，支持：
 * - 实时音频流传输
 * - 中间识别结果
 * - 最终识别结果
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseServerASRReturn {
  isListening: boolean;
  isConnected: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  volumeLevel: number;
}

interface ASRMessage {
  type: 'started' | 'result' | 'finished' | 'error';
  text?: string;
  isFinal?: boolean;
  message?: string;
}

export function useServerASR(
  onTranscript?: (text: string, isFinal: boolean) => void
): UseServerASRReturn {
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  const analyzeVolume = useCallback(() => {
    if (!analyserRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length / 255;
    setVolumeLevel(average);

    animationFrameRef.current = requestAnimationFrame(analyzeVolume);
  }, []);

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
    }
    wsRef.current = null;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setIsConnected(false);
    setVolumeLevel(0);
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsListening(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      mediaStreamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/asr`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data: ASRMessage = JSON.parse(event.data);
          
          switch (data.type) {
            case 'started':
              break;
            case 'result':
              if (data.text) {
                if (data.isFinal) {
                  setTranscript(prev => prev + (prev ? '\n' : '') + data.text);
                  setInterimTranscript('');
                  onTranscript?.(data.text, true);
                } else {
                  setInterimTranscript(data.text);
                  onTranscript?.(data.text, false);
                }
              }
              break;
            case 'finished':
              stopListening();
              break;
            case 'error':
              setError(data.message || '语音识别错误');
              stopListening();
              break;
          }
        } catch (e) {
          console.error('[ServerASR] Failed to parse message:', e);
        }
      };

      ws.onerror = () => {
        setError('连接语音服务失败');
        stopListening();
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        ws.send(pcmData.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      animationFrameRef.current = requestAnimationFrame(analyzeVolume);

    } catch (err: any) {
      console.error('[ServerASR] Failed to start:', err);
      setError(err.message || '无法访问麦克风');
      setIsListening(false);
    }
  }, [stopListening, onTranscript, analyzeVolume]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isConnected,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    volumeLevel,
  };
}
