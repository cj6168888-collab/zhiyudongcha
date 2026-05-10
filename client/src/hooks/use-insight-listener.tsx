/**
 * 智语洞察 (Insight Listener) 前端Hook
 *
 * 提供持续监听、场景自动识别、隐蔽反馈功能
 */

import { useState, useCallback, useRef, useEffect, createContext, useContext, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

export type ListeningMode = 'MEETING' | 'CONVERSATION' | 'CASUAL' | 'NEGOTIATION' | 'SILENT';

export interface InsightSession {
  id: string;
  userId: string;
  mode: ListeningMode;
  startTime: Date;
  isActive: boolean;
  speakerCount: number;
  transcriptCount: number;
  entityCount: number;
  alertCount: number;
}

export interface InsightAlert {
  id: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description?: string;
  suggestedAction?: string;
}

export interface SceneTransition {
  fromMode: ListeningMode;
  toMode: ListeningMode;
  timestamp: Date;
  reason: string;
}

interface InsightListenerContextType {
  isListening: boolean;
  currentMode: ListeningMode;
  session: InsightSession | null;
  transcript: string;
  volumeLevel: number;
  analyser: AnalyserNode | null;
  alerts: InsightAlert[];
  sceneHistory: SceneTransition[];
  startListening: (mode?: ListeningMode) => Promise<void>;
  stopListening: () => Promise<void>;
  toggleListening: () => void;
  clearAlerts: () => void;
  acknowledgeAlert: (alertId: string) => void;
}

const InsightListenerContext = createContext<InsightListenerContextType | null>(null);

const MODE_DISPLAY_NAMES: Record<ListeningMode, string> = {
  MEETING: '会议模式',
  CONVERSATION: '谈话模式',
  CASUAL: '闲谈模式',
  NEGOTIATION: '谈判模式',
  SILENT: '静默模式',
};

export function InsightListenerProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [isListening, setIsListening] = useState(false);
  const [currentMode, setCurrentMode] = useState<ListeningMode>('SILENT');
  const [session, setSession] = useState<InsightSession | null>(null);
  const [transcript, setTranscript] = useState("");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [sceneHistory, setSceneHistory] = useState<SceneTransition[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);
  const pendingTextRef = useRef<string>("");
  const sendTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const analyzeVolume = useCallback(() => {
    if (!analyserRef.current) return;

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

  const sendTranscriptToServer = useCallback(async (text: string) => {
    if (!session || !text.trim()) return;

    try {
      const response = await fetch('/api/insight/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          text: text.trim(),
          isMaster: true,
          startTime: Date.now() / 1000,
          endTime: Date.now() / 1000,
          confidence: 0.9,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.alerts && data.alerts.length > 0) {
          setAlerts(prev => [...prev, ...data.alerts]);

          for (const alert of data.alerts) {
            if (alert.priority === 'HIGH' || alert.priority === 'URGENT') {
              toast({
                title: alert.title,
                description: alert.suggestedAction || alert.description,
                duration: 5000,
              });
            }
          }
        }

        if (data.sceneChange) {
          setSceneHistory(prev => [...prev, data.sceneChange]);
          const toMode = data.sceneChange.toMode as ListeningMode;
          setCurrentMode(toMode);

          toast({
            title: `场景切换: ${MODE_DISPLAY_NAMES[toMode]}`,
            description: data.sceneChange.reason,
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error('[InsightListener] 发送转写失败:', error);
    }
  }, [session, toast]);

  const debouncedSend = useCallback((text: string) => {
    pendingTextRef.current = text;

    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
    }

    sendTimeoutRef.current = setTimeout(() => {
      if (pendingTextRef.current) {
        sendTranscriptToServer(pendingTextRef.current);
        pendingTextRef.current = "";
      }
    }, 2000);
  }, [sendTranscriptToServer]);

  const startListening = useCallback(async (initialMode?: ListeningMode) => {
    try {
      const response = await fetch('/api/insight/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default',
          mode: initialMode || 'SILENT',
        }),
      });

      if (!response.ok) {
        throw new Error('启动会话失败');
      }

      const data = await response.json();
      setSession(data.session);
      setCurrentMode(data.session.mode);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyserNode);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onresult = (event: any) => {
          let final = '';
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += text;
            } else {
              interim += text;
            }
          }

          setTranscript(final || interim);

          if (final) {
            debouncedSend(final);
          }
        };

        recognition.onerror = (error: any) => {
          console.error('[InsightListener] Recognition error:', error);
        };

        recognition.onend = () => {
          if (mediaStreamRef.current && isListening) {
            try {
              recognition.start();
            } catch (e) {
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      setIsListening(true);
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);

      const sessionMode = data.session.mode as ListeningMode;
      toast({
        title: "智语洞察已启动",
        description: `当前模式: ${MODE_DISPLAY_NAMES[sessionMode]}`,
        duration: 2000,
      });
    } catch (error) {
      console.error('[InsightListener] 启动失败:', error);
      toast({
        title: "启动失败",
        description: "无法访问麦克风或服务器错误",
        variant: "destructive",
      });
    }
  }, [analyzeVolume, debouncedSend, toast, isListening]);

  const stopListening = useCallback(async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
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

    analyserRef.current = null;
    setAnalyser(null);
    setIsListening(false);
    setTranscript("");
    setVolumeLevel(0);

    if (session) {
      try {
        await fetch(`/api/insight/session/${session.id}/end`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('[InsightListener] 结束会话失败:', error);
      }
    }

    setSession(null);
    setCurrentMode('SILENT');

    toast({
      title: "智语洞察已停止",
      duration: 2000,
    });
  }, [session, toast]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <InsightListenerContext.Provider value={{
      isListening,
      currentMode,
      session,
      transcript,
      volumeLevel,
      analyser,
      alerts,
      sceneHistory,
      startListening,
      stopListening,
      toggleListening,
      clearAlerts,
      acknowledgeAlert,
    }}>
      {children}
    </InsightListenerContext.Provider>
  );
}

export function useInsightListener() {
  const context = useContext(InsightListenerContext);
  if (!context) {
    throw new Error("useInsightListener must be used within an InsightListenerProvider");
  }
  return context;
}

export { MODE_DISPLAY_NAMES };
