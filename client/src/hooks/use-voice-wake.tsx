import { useState, useCallback, useRef, useEffect, createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const QUICK_RESPONSES = [
  "好的，主人，我在听",
  "请说，我在",
  "小星在，请吩咐",
  "嗯，我听着呢",
  "主人请说",
];

interface VoiceCommandResponse {
  success: boolean;
  message: string;
  action?: string;
  navigateTo?: string;
  data?: any;
  requiresConfirm?: boolean;
  confirmMessage?: string;
  continueListen?: boolean;
  aiUsed?: boolean;
  parsed?: {
    understood: boolean;
    confidence: number;
    action?: string;
    module?: string;
    target?: string;
  };
}

interface VoiceWakeContextType {
  isListening: boolean;
  transcript: string;
  analyser: AnalyserNode | null;
  volumeLevel: number;
  isProcessing: boolean;
  lastResponse: VoiceCommandResponse | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => void;
  executeCommand: (text: string) => Promise<VoiceCommandResponse | null>;
}

const VoiceWakeContext = createContext<VoiceWakeContextType | null>(null);

export function VoiceWakeProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<VoiceCommandResponse | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const speakResponse = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.1;
      speechSynthesis.speak(utterance);
    }
  }, []);

  const speakQuickResponse = useCallback(() => {
    const response = QUICK_RESPONSES[Math.floor(Math.random() * QUICK_RESPONSES.length)];
    speakResponse(response);
    toast({ title: response, duration: 2000 });
  }, [toast, speakResponse]);

  const executeCommand = useCallback(async (text: string): Promise<VoiceCommandResponse | null> => {
    if (!text.trim() || isProcessing) return null;

    setIsProcessing(true);
    try {
      const response = await apiRequest('POST', '/api/voice/command', { text });
      const result = await response.json() as VoiceCommandResponse;

      setLastResponse(result);

      if (result.message) {
        speakResponse(result.message);
        toast({
          title: result.message,
          description: result.aiUsed ? '(AI推理)' : undefined,
          duration: 3000
        });
      }

      if (result.navigateTo && result.success) {
        setLocation(result.navigateTo);
      }

      return result;
    } catch (error) {
      console.error('语音指令执行失败:', error);
      const errorMsg = '抱歉，指令执行出了点问题';
      speakResponse(errorMsg);
      toast({ title: errorMsg, variant: 'destructive', duration: 3000 });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, speakResponse, toast, setLocation]);

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

  const startListening = useCallback(async () => {
    try {
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
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += text;
            } else {
              interim += text;
            }
          }

          if (final) {
            setTranscript(final);
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
            }
            silenceTimeoutRef.current = setTimeout(() => {
              executeCommand(final);
            }, 1500);
          } else {
            setTranscript(interim);
          }
        };

        recognition.onerror = () => {
          stopListening();
        };

        recognition.onend = () => {
          if (mediaStreamRef.current) {
            try {
              recognition.start();
            } catch (e) {
              stopListening();
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      setIsListening(true);
      speakQuickResponse();
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
    } catch (error) {
      toast({
        title: "无法访问麦克风",
        description: "请允许浏览器访问麦克风",
        variant: "destructive"
      });
    }
  }, [analyzeVolume, speakQuickResponse, toast]);

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
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
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return (
    <VoiceWakeContext.Provider value={{
      isListening,
      transcript,
      analyser,
      volumeLevel,
      isProcessing,
      lastResponse,
      startListening,
      stopListening,
      toggleListening,
      executeCommand,
    }}>
      {children}
    </VoiceWakeContext.Provider>
  );
}

export function useVoiceWake() {
  const context = useContext(VoiceWakeContext);
  if (!context) {
    throw new Error("useVoiceWake must be used within a VoiceWakeProvider");
  }
  return context;
}
