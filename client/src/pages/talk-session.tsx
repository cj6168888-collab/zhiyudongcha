import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Mic,
  MicOff,
  ArrowLeft,
  Play,
  Square,
  Users,
  FolderKanban,
  Lightbulb,
  MessageSquare,
  Clock,
  Brain,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Building,
  Target,
  TrendingUp,
  Volume2,
  Cloud,
  Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { TalkSession, ExtractedEntity, OpportunitySignal } from "@/shared/types";

type ASRMode = 'browser' | 'server' | 'manual';

type AnalysisPhase = 'idle' | 'listening' | 'analyzing' | 'extracting' | 'completed';

const TALK_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CASUAL: { label: '闲聊', color: 'bg-gray-500', icon: <MessageSquare className="w-4 h-4" /> },
  MEETING: { label: '会见', color: 'bg-blue-500', icon: <Users className="w-4 h-4" /> },
  NEGOTIATION: { label: '谈判', color: 'bg-red-500', icon: <Target className="w-4 h-4" /> },
  CONFERENCE: { label: '开会', color: 'bg-purple-500', icon: <Users className="w-4 h-4" /> },
  CONSULTATION: { label: '磋商', color: 'bg-orange-500', icon: <MessageSquare className="w-4 h-4" /> },
  BRAINSTORM: { label: '头脑风暴', color: 'bg-yellow-500', icon: <Lightbulb className="w-4 h-4" /> },
  INTERVIEW: { label: '面试', color: 'bg-green-500', icon: <User className="w-4 h-4" /> },
  PITCH: { label: '推销/路演', color: 'bg-pink-500', icon: <TrendingUp className="w-4 h-4" /> },
  UNKNOWN: { label: '识别中...', color: 'bg-muted', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
};

export default function TalkSessionPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { role } = useZ1Store();
  
  const [isListening, setIsListening] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [asrMode, setAsrMode] = useState<ASRMode>('browser');
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef("");
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const stopVoiceRecognition = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
      }
      recognitionRef.current = null;
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
    
    setVolumeLevel(0);
  }, []);

  const startServerASR = useCallback(async () => {
    try {
      setVoiceError(null);
      setAsrMode('server');

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
        setVoiceError(null);
        toast({ title: "云端语音识别已连接", description: "正在使用服务端语音识别" });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'started':
              break;
            case 'result':
              if (data.text) {
                if (data.isFinal) {
                  setTranscript((prev) => prev + (prev ? '\n' : '') + data.text);
                  setInterimTranscript('');
                } else {
                  setInterimTranscript(data.text);
                }
              }
              break;
            case 'finished':
              break;
            case 'error':
              setVoiceError(data.message || '语音识别错误');
              break;
          }
        } catch (e) {
          console.error('[ServerASR] Failed to parse message:', e);
        }
      };

      ws.onerror = () => {
        setVoiceError('云端语音服务连接失败，请使用手动输入');
        setAsrMode('manual');
      };

      ws.onclose = () => {
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
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        wsRef.current.send(pcmData.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const analyzeVolume = () => {
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
      };
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);

    } catch (err: any) {
      console.error('[ServerASR] Failed to start:', err);
      setVoiceError(err.message || '无法访问麦克风');
      setAsrMode('manual');
    }
  }, [toast]);

  const startVoiceRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSpeechSupported(false);
      toast({
        title: "浏览器语音识别不可用",
        description: "正在尝试云端语音识别...",
      });
      startServerASR();
      return;
    }

    stopVoiceRecognition();
    setVoiceError(null);
    setAsrMode('browser');

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setVoiceError(null);
    };

    recognition.onresult = (event) => {
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
        setTranscript((prev) => {
          const newTranscript = prev + (prev ? '\n' : '') + final;
          return newTranscript;
        });
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        return;
      }
      if (event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed') {
        setVoiceError('麦克风权限被拒绝');
        return;
      }
      console.warn('[BrowserASR] Error:', event.error, '- switching to server ASR');
      setVoiceError(`浏览器语音识别失败(${event.error})，切换到云端...`);
      stopVoiceRecognition();
      startServerASR();
    };

    recognition.onend = () => {
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setVoiceError("浏览器语音识别启动失败，切换到云端...");
      startServerASR();
    }
  }, [stopVoiceRecognition, toast, startServerASR]);

  // Fetch current session
  const { data: currentSession, refetch: refetchSession } = useQuery<TalkSession>({
    queryKey: ["talk-session", currentSessionId],
    queryFn: async () => {
      const res = await fetch(`/api/talk-sessions/${currentSessionId}`);
      return res.json();
    },
    enabled: !!currentSessionId,
    refetchInterval: isListening ? 2000 : false,
  });

  // Fetch extracted entities
  const { data: entities = [] } = useQuery<ExtractedEntity[]>({
    queryKey: ["extracted-entities", currentSessionId],
    queryFn: async () => {
      const res = await fetch(`/api/talk-sessions/${currentSessionId}/entities`);
      return res.json();
    },
    enabled: !!currentSessionId,
  });

  // Fetch opportunities
  const { data: opportunities = [] } = useQuery<OpportunitySignal[]>({
    queryKey: ["opportunities", currentSessionId],
    queryFn: async () => {
      const res = await fetch(`/api/talk-sessions/${currentSessionId}/opportunities`);
      return res.json();
    },
    enabled: !!currentSessionId,
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/talk-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "zh-CN" }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
      setIsListening(true);
      setElapsedTime(0);
      startVoiceRecognition();
      toast({ title: "开始监听", description: "正在智能分析谈话内容..." });
    },
  });

  useEffect(() => {
    return () => {
      stopVoiceRecognition();
    };
  }, [stopVoiceRecognition]);

  // Stop session mutation
  const stopSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/talk-sessions/${currentSessionId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawTranscript: transcript }),
      });
      return res.json();
    },
    onSuccess: () => {
      setIsListening(false);
      refetchSession();
      queryClient.invalidateQueries({ queryKey: ["extracted-entities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast({ title: "分析完成", description: "正在提取联系人和商机..." });
    },
  });

  // Analyze text mutation
  const analyzeTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/talk-sessions/${currentSessionId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchSession();
      queryClient.invalidateQueries({ queryKey: ["extracted-entities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  // Timer effect
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isListening]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setAnalysisPhase('listening');
    setAnalysisProgress(0);
    setTranscript("");
    setInterimTranscript("");
    startSessionMutation.mutate();
  };

  const handleStop = async () => {
    stopVoiceRecognition();
    setAnalysisPhase('analyzing');
    setAnalysisProgress(30);
    
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);
    
    stopSessionMutation.mutate(undefined, {
      onSettled: () => {
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        setAnalysisPhase('completed');
      },
    });
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    setTranscript((prev) => prev + (prev ? "\n" : "") + manualInput);
    if (currentSessionId) {
      analyzeTextMutation.mutate(manualInput);
    }
    setManualInput("");
  };

  const talkTypeInfo = currentSession?.talkType 
    ? TALK_TYPE_LABELS[currentSession.talkType] || TALK_TYPE_LABELS.UNKNOWN
    : TALK_TYPE_LABELS.UNKNOWN;

  const personEntities = entities.filter(e => e.entityType === 'PERSON');
  const companyEntities = entities.filter(e => e.entityType === 'COMPANY');
  const projectEntities = entities.filter(e => e.entityType === 'PROJECT');

  return (
    <div className="min-h-screen bg-background px-6 pt-6 pb-24 md:pb-6">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-light flex items-center gap-3">
            <Brain className="w-7 h-7 text-primary" />
            智能谈话分析
          </h1>
          <p className="text-sm text-muted-foreground">
            监听 · 分析 · 自动建档 · 发现商机
          </p>
        </div>
        {isListening && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isListening ? <Mic className="w-5 h-5 text-red-500 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                  谈话监听
                </span>
                {currentSession && (
                  <Badge className={cn("text-white", talkTypeInfo.color)}>
                    {talkTypeInfo.icon}
                    <span className="ml-1">{talkTypeInfo.label}</span>
                    {currentSession.talkTypeConfidence && currentSession.talkTypeConfidence > 0 && (
                      <span className="ml-1 opacity-70">({Math.round(currentSession.talkTypeConfidence * 100)}%)</span>
                    )}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                智能分辨谈话类型：闲聊、会见、谈判、开会、磋商、头脑风暴...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                {!isListening ? (
                  <Button 
                    onClick={handleStart} 
                    className="flex-1"
                    disabled={startSessionMutation.isPending}
                    data-testid="button-start-listening"
                  >
                    {startSessionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    开始谈话
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStop} 
                    variant="destructive" 
                    className="flex-1"
                    disabled={stopSessionMutation.isPending}
                    data-testid="button-stop-listening"
                  >
                    {stopSessionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4 mr-2" />
                    )}
                    结束谈话
                  </Button>
                )}
              </div>

              {isListening && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-primary/5 border border-primary/20 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      {asrMode === 'server' ? (
                        <>
                          <Cloud className="w-4 h-4 text-blue-500" />
                          <span className="text-blue-500">云端语音识别</span>
                        </>
                      ) : asrMode === 'browser' ? (
                        <>
                          <Wifi className="w-4 h-4 text-green-500" />
                          <span className="text-green-500">浏览器语音识别</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-yellow-500" />
                          <span className="text-yellow-500">手动输入模式</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className={cn(
                            "w-1 rounded-full transition-colors",
                            i < Math.ceil(volumeLevel * 7 * 3) ? "bg-green-500" : "bg-gray-600"
                          )}
                          animate={{
                            height: i < Math.ceil(volumeLevel * 7 * 3) 
                              ? `${Math.max(4, (i + 1) * 2 + volumeLevel * 16)}px` 
                              : '4px',
                          }}
                          transition={{ duration: 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {asrMode === 'manual' 
                      ? '请在下方文本框手动输入谈话内容' 
                      : '正在实时转录语音内容...'}
                  </p>
                </motion.div>
              )}

              {voiceError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {voiceError}
                  {asrMode === 'manual' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setVoiceError(null);
                        startServerASR();
                      }}
                    >
                      重试云端
                    </Button>
                  )}
                </div>
              )}

              {analysisPhase === 'analyzing' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在分析谈话内容...
                  </div>
                  <Progress value={analysisProgress} className="h-2" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="谈话内容isspeechsupported-实时语音转文字-" className="text-sm text-muted-foreground">
                    谈话内容（{isSpeechSupported ? "实时语音转文字" : "手动输入"})
                  </label>
                  {isListening && isSpeechSupported && (
                    <div className="flex items-center gap-2 text-xs text-green-500">
                      <Volume2 className="w-3 h-3 animate-pulse" />
                      语音识别中
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Textarea
                    placeholder={isListening ? "正在录音，请说话..." : "点击【开始谈话】启动录音..."}
                    value={transcript + (interimTranscript ? `\n[${interimTranscript}]` : '')}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTranscript(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-transcript"
                    readOnly={isListening}
                  />
                  {isListening && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">录音中</span>
                    </div>
                  )}
                </div>
              </div>

              {isListening && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="输入新的对话片段..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    rows={2}
                    className="flex-1"
                    data-testid="input-manual"
                  />
                  <Button 
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim() || analyzeTextMutation.isPending}
                    data-testid="button-submit-manual"
                  >
                    {analyzeTextMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}

              {analysisPhase === 'completed' && currentSession?.status === 'completed' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 text-sm flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  分析完成！已提取 {entities.length} 个实体，发现 {opportunities.length} 个商机
                </motion.div>
              )}

              {currentSession?.summary && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-primary/5 rounded-lg border border-primary/20"
                >
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    AI 摘要
                  </h4>
                  <p className="text-sm text-muted-foreground">{currentSession.summary}</p>
                </motion.div>
              )}

              {currentSession?.keyPoints && currentSession.keyPoints.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-4 bg-secondary/30 rounded-lg"
                >
                  <h4 className="font-medium mb-2">关键要点</h4>
                  <ul className="space-y-1">
                    {currentSession.keyPoints.map((point, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {currentSession?.actionItems && currentSession.actionItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                >
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-600" />
                    待办事项
                  </h4>
                  <ul className="space-y-1">
                    {currentSession.actionItems.map((item, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-600 text-xs flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Tabs defaultValue="people" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="people" className="flex-1">
                <Users className="w-4 h-4 mr-1" />
                人物
              </TabsTrigger>
              <TabsTrigger value="opportunities" className="flex-1">
                <Lightbulb className="w-4 h-4 mr-1" />
                商机
              </TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    识别的人物 ({personEntities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {personEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      暂未识别到人物信息
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {personEntities.map((entity) => (
                        <div 
                          key={entity.id} 
                          className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{entity.entityValue}</span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round((entity.confidence || 0) * 100)}%
                            </Badge>
                          </div>
                          {entity.context && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {entity.context}
                            </p>
                          )}
                          {entity.linkedPersonId ? (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              已关联
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="mt-2 text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              待创建
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    识别的组织 ({companyEntities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {companyEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      暂未识别到组织信息
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {companyEntities.map((entity) => (
                        <Badge key={entity.id} variant="secondary">
                          <Building className="w-3 h-3 mr-1" />
                          {entity.entityValue}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderKanban className="w-4 h-4" />
                    识别的项目 ({projectEntities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {projectEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      暂未识别到项目信息
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {projectEntities.map((entity) => (
                        <div key={entity.id} className="p-2 rounded bg-secondary/30">
                          <span className="text-sm">{entity.entityValue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="opportunities" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    发现的商机 ({opportunities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {opportunities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      暂未发现商机信号
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {opportunities.map((opp) => (
                        <div 
                          key={opp.id}
                          className="p-3 rounded-lg border border-primary/30 bg-primary/5"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{opp.title}</h4>
                            <Badge 
                              variant={opp.urgency === 'HIGH' || opp.urgency === 'CRITICAL' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {opp.urgency}
                            </Badge>
                          </div>
                          {opp.description && (
                            <p className="text-xs text-muted-foreground mb-2">
                              {opp.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs">
                            {opp.estimatedValue && (
                              <Badge variant="outline">
                                ¥{opp.estimatedValue.toLocaleString()}
                              </Badge>
                            )}
                            <Badge variant="outline">
                              成功率 {Math.round((opp.probability || 0) * 100)}%
                            </Badge>
                          </div>
                          {opp.suggestedActions && opp.suggestedActions.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs font-medium mb-1">建议行动:</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {opp.suggestedActions.slice(0, 2).map((action, i) => (
                                  <li key={i}>• {action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
