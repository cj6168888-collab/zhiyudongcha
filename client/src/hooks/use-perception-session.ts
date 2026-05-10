/**
 * 感知会话Hook - 管理小星的视觉/听觉感知
 *
 * 连接后端感知核心服务，发送视觉和听觉数据
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PerceptionSession {
  id: string;
  deviceId: string;
  isActive: boolean;
  visionEnabled: boolean;
  audioEnabled: boolean;
}

export interface PerceptionResponse {
  type: 'DISPLAY' | 'SPEAK' | 'BOTH' | 'SILENT';
  displayText?: string;
  speakText?: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  action?: string;
  reasoning?: string;
}

interface PerceptionState {
  session: PerceptionSession | null;
  isProcessing: boolean;
  lastResponse: PerceptionResponse | null;
  visionActive: boolean;
  audioActive: boolean;
  error: string | null;
}

export function usePerceptionSession(deviceId: string) {
  const [state, setState] = useState<PerceptionState>({
    session: null,
    isProcessing: false,
    lastResponse: null,
    visionActive: false,
    audioActive: false,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const visionIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/perception/session', { deviceId });
      return res.json();
    },
    onSuccess: (data) => {
      setState(s => ({ ...s, session: data.session, error: null }));
    },
    onError: (err: any) => {
      setState(s => ({ ...s, error: err.message || '创建会话失败' }));
    },
  });

  const perceiveMutation = useMutation({
    mutationFn: async ({ sessionId, imageBase64, transcript }: { sessionId: string; imageBase64?: string; transcript?: string }) => {
      const res = await apiRequest('POST', `/api/perception/session/${sessionId}/perceive`, { imageBase64, transcript });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.response) {
        setState(s => ({ ...s, lastResponse: data.response, isProcessing: false }));
      } else {
        setState(s => ({ ...s, isProcessing: false }));
      }
    },
    onError: (err: any) => {
      setState(s => ({ ...s, error: err.message || '感知请求失败', isProcessing: false }));
    },
  });

  const sendVisionFrame = useCallback(async (imageBase64: string) => {
    if (!state.session) return;

    try {
      const res = await apiRequest('POST', `/api/perception/session/${state.session.id}/vision`, { imageBase64 });
      const data = await res.json();
      if (data.response && data.response.type !== 'SILENT') {
        setState(s => ({ ...s, lastResponse: data.response }));
      }
    } catch (err) {
      console.error('发送视觉帧失败:', err);
    }
  }, [state.session]);

  const sendAudioSegment = useCallback(async (transcript: string, language: string = 'zh') => {
    if (!state.session) return;

    try {
      const res = await apiRequest('POST', `/api/perception/session/${state.session.id}/audio`, { transcript, language });
      const data = await res.json();
      if (data.response && data.response.type !== 'SILENT') {
        setState(s => ({ ...s, lastResponse: data.response }));
      }
    } catch (err) {
      console.error('发送听觉片段失败:', err);
    }
  }, [state.session]);

  const startSession = useCallback(async () => {
    await createSessionMutation.mutateAsync();
  }, [createSessionMutation]);

  const endSession = useCallback(() => {
    stopVision();
    stopAudio();
    setState(s => ({ ...s, session: null }));
  }, []);

  const startVision = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!state.session) {
      setState(s => ({ ...s, error: '请先创建会话' }));
      return;
    }

    videoRef.current = video;
    canvasRef.current = canvas;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 }
      });
      video.srcObject = stream;
      mediaStreamRef.current = stream;

      await video.play();

      visionIntervalRef.current = window.setInterval(() => {
        if (!canvasRef.current || !videoRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);

        const imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];
        sendVisionFrame(imageBase64);
      }, 3000);

      setState(s => ({ ...s, visionActive: true, error: null }));
    } catch (err: any) {
      setState(s => ({ ...s, error: err.message || '无法访问摄像头' }));
    }
  }, [state.session, sendVisionFrame]);

  const stopVision = useCallback(() => {
    if (visionIntervalRef.current) {
      clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setState(s => ({ ...s, visionActive: false }));
  }, []);

  const startAudio = useCallback(() => {
    if (!state.session) {
      setState(s => ({ ...s, error: '请先创建会话' }));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState(s => ({ ...s, error: '此浏览器不支持语音识别' }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      sendAudioSegment(transcript, 'zh');
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error('语音识别错误:', event.error);
      }
    };

    recognition.onend = () => {
      if (state.audioActive && recognitionRef.current) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    setState(s => ({ ...s, audioActive: true, error: null }));
  }, [state.session, state.audioActive, sendAudioSegment]);

  const stopAudio = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState(s => ({ ...s, audioActive: false }));
  }, []);

  const captureCurrentFrame = useCallback((): string | null => {
    if (!canvasRef.current || !videoRef.current) return null;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return null;

    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    return canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];
  }, []);

  const perceive = useCallback(async (transcript?: string) => {
    if (!state.session) return;

    setState(s => ({ ...s, isProcessing: true }));

    const imageBase64 = state.visionActive ? captureCurrentFrame() : null;

    if (!imageBase64 && !transcript) {
      setState(s => ({ ...s, error: '请先开启视觉或提供语音输入', isProcessing: false }));
      return;
    }

    await perceiveMutation.mutateAsync({
      sessionId: state.session.id,
      imageBase64: imageBase64 || undefined,
      transcript
    });
  }, [state.session, state.visionActive, captureCurrentFrame, perceiveMutation]);

  useEffect(() => {
    return () => {
      stopVision();
      stopAudio();
    };
  }, []);

  return {
    ...state,
    startSession,
    endSession,
    startVision,
    stopVision,
    startAudio,
    stopAudio,
    perceive,
    isCreatingSession: createSessionMutation.isPending,
  };
}
