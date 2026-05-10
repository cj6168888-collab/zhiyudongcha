import { useState, useCallback, useRef, useEffect, createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const QUICK_RESPONSES = [
  "好的，主人，我在听",
  "请说，我在",
  "小智在，请吩咐",
  "嗯，我听着呢",
  "主人请说",
];

interface VoiceWakeContextType {
  isListening: boolean;
  transcript: string;
  analyser: AnalyserNode | null;
  volumeLevel: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => void;
}

const VoiceWakeContext = createContext<VoiceWakeContextType | null>(null);

export function VoiceWakeProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);

  const speakQuickResponse = useCallback(() => {
    const response = QUICK_RESPONSES[Math.floor(Math.random() * QUICK_RESPONSES.length)];
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(response);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.1;
      speechSynthesis.speak(utterance);
    }
    toast({ title: response, duration: 2000 });
  }, [toast]);

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
      startListening,
      stopListening,
      toggleListening,
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
