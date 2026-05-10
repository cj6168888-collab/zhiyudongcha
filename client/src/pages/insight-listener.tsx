import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { AudioWaveform, CircularWaveform } from "@/components/audio/audio-waveform";
import {
  Mic,
  MicOff,
  Users,
  MessageCircle,
  Coffee,
  Handshake,
  VolumeX,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Brain,
  Headphones,
  Watch,
  Smartphone,
  Volume2,
  TrendingUp,
  BarChart3,
  Zap,
  Eye,
  EyeOff,
  User,
  Briefcase,
  Building,
  DollarSign,
  CalendarClock,
  Lightbulb,
  AlertCircle
} from "lucide-react";

type ListeningMode = 'MEETING' | 'CONVERSATION' | 'CASUAL' | 'NEGOTIATION' | 'SILENT';

interface InsightSession {
  id: string;
  userId: string;
  mode: ListeningMode;
  startTime: string;
  isActive: boolean;
  speakerCount: number;
  transcriptCount: number;
  entityCount: number;
  alertCount: number;
}

interface InsightStats {
  activeSessions: number;
  totalTranscripts: number;
  totalEntities: number;
  totalAlerts: number;
  modeDistribution: Record<ListeningMode, number>;
}

interface InsightMode {
  id: ListeningMode;
  name: string;
  description: string;
  icon: string;
}

interface HistorySession {
  id: string;
  userId: string;
  mode: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  transcriptCount: number;
  entityCount: number;
}

interface TranscriptItem {
  id: string;
  speakerName: string | null;
  isMaster: boolean;
  text: string;
  startTime: number;
  endTime: number;
  emotion: string | null;
  keywords: string[];
}

interface EntityItem {
  id: string;
  type: string;
  value: string;
  context: string | null;
  confidence: number;
  importance: number;
  relatedSpeaker: string | null;
  linkedPersonId: string | null;
  linkedOrganizationId: string | null;
  createdAt: string;
}

const MODE_ICONS: Record<string, React.ComponentType<any>> = {
  users: Users,
  'message-circle': MessageCircle,
  coffee: Coffee,
  handshake: Handshake,
  'volume-x': VolumeX,
};

const MODE_COLORS: Record<ListeningMode, string> = {
  MEETING: 'bg-blue-500',
  CONVERSATION: 'bg-green-500',
  CASUAL: 'bg-yellow-500',
  NEGOTIATION: 'bg-purple-500',
  SILENT: 'bg-gray-500',
};

export default function InsightListenerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isListening, setIsListening] = useState(false);
  const [currentMode, setCurrentMode] = useState<ListeningMode>('SILENT');
  const [currentSession, setCurrentSession] = useState<InsightSession | null>(null);
  const [transcript, setTranscript] = useState("");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState([0.7]);
  const [activeTab, setActiveTab] = useState<'realtime' | 'history'>('realtime');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [stealthMode, setStealthMode] = useState(false);

  const { data: stats, refetch: refetchStats } = useQuery<InsightStats>({
    queryKey: ['/api/insight/stats'],
    refetchInterval: isListening ? 3000 : 10000,
  });

  const { data: modesData } = useQuery<{ modes: InsightMode[] }>({
    queryKey: ['/api/insight/modes'],
  });

  const { data: activeSessions } = useQuery<{ count: number; sessions: InsightSession[] }>({
    queryKey: ['/api/insight/sessions/active'],
    refetchInterval: 5000,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery<{ sessions: HistorySession[]; hasMore: boolean }>({
    queryKey: ['/api/insight/sessions/history'],
    enabled: activeTab === 'history',
  });

  const { data: sessionTranscripts } = useQuery<{ transcripts: TranscriptItem[] }>({
    queryKey: ['/api/insight/session', selectedSessionId, 'transcripts'],
    queryFn: async () => {
      const res = await fetch(`/api/insight/session/${selectedSessionId}/transcripts`);
      return res.json();
    },
    enabled: !!selectedSessionId,
  });

  const { data: sessionEntities, refetch: refetchEntities } = useQuery<{ entities: EntityItem[] }>({
    queryKey: ['/api/insight/session', selectedSessionId, 'entities'],
    queryFn: async () => {
      const res = await fetch(`/api/insight/session/${selectedSessionId}/entities`);
      return res.json();
    },
    enabled: !!selectedSessionId,
  });

  const adoptEntityMutation = useMutation({
    mutationFn: async ({ entityId, targetType }: { entityId: string; targetType: 'person' | 'project' }) => {
      const res = await fetch(`/api/insight/entity/${entityId}/adopt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "采纳成功", description: data.message });
        refetchEntities();
      } else {
        toast({ title: "采纳失败", description: data.error, variant: "destructive" });
      }
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async (mode: ListeningMode) => {
      const res = await fetch('/api/insight/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'default', mode }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentSession(data.session);
      setCurrentMode(data.session.mode);
      toast({ title: "智语洞察已启动", description: `模式: ${data.session.mode}` });
      refetchStats();
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/insight/session/${sessionId}/end`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      setCurrentSession(null);
      setCurrentMode('SILENT');
      toast({ title: "智语洞察已停止" });
      refetchStats();
      refetchHistory();
    },
  });

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

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
        });
      }
    } catch (err) {
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const startListening = async (mode: ListeningMode = 'SILENT') => {
    try {
      await startSessionMutation.mutateAsync(mode);

      await requestWakeLock();
      setStealthMode(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserRef.current = analyserNode;

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

          if (final && currentSession) {
            sendTranscript(final);
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (mediaStreamRef.current && isListening) {
            try { recognition.start(); } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      setIsListening(true);
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
    } catch (error) {
      toast({ title: "启动失败", description: "无法访问麦克风", variant: "destructive" });
    }
  };

  const stopListening = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(track => track.stop()); mediaStreamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }

    releaseWakeLock();
    setStealthMode(false);

    analyserRef.current = null;
    setIsListening(false);
    setTranscript("");
    setVolumeLevel(0);

    if (currentSession) {
      endSessionMutation.mutate(currentSession.id);
    }
  };

  const sendTranscript = async (text: string) => {
    if (!currentSession) return;
    try {
      const res = await fetch('/api/insight/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          text,
          isMaster: true,
          startTime: Date.now() / 1000,
          endTime: Date.now() / 1000,
          confidence: 0.9,
        }),
      });
      const data = await res.json();

      if (data.alerts?.length > 0) {
        for (const alert of data.alerts) {
          if (alert.priority === 'HIGH' || alert.priority === 'URGENT') {
            toast({ title: alert.title, description: alert.suggestedAction });
          }
        }
      }

      if (data.sceneChange) {
        setCurrentMode(data.sceneChange.toMode);
        toast({ title: `场景切换`, description: `已切换到 ${data.sceneChange.toMode} 模式` });
      }

      refetchStats();
    } catch (error) {}
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const modes = modesData?.modes || [];

  if (stealthMode && isListening) {
    return (
      <div
        className="min-h-screen bg-black flex flex-col items-center justify-center p-6"
        onClick={() => setStealthMode(false)}
      >
        <div className="text-center space-y-8">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center"
          >
            <Mic className="w-12 h-12 text-amber-400/60" />
          </motion.div>

          <div className="space-y-2">
            <p className="text-slate-600 text-sm">智语洞察运行中</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-slate-500 text-xs">{currentMode}</span>
            </div>
          </div>

          {transcript && (
            <p className="text-slate-700 text-xs max-w-xs mx-auto line-clamp-2">
              {transcript}
            </p>
          )}

          <div className="pt-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); stopListening(); }}
              className="text-slate-600 hover:text-red-400 hover:bg-red-500/10"
            >
              <MicOff className="w-4 h-4 mr-2" />
              停止监听
            </Button>
          </div>

          <p className="text-slate-700 text-xs">点击屏幕任意位置查看详情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-24 md:pb-6">
      <GlobalWakeHeader />

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-amber-400" />
              智语洞察
            </h1>
            <p className="text-slate-400 mt-1">实时监听与智能分析</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">唤醒词</span>
              <Switch checked={wakeWordEnabled} onCheckedChange={setWakeWordEnabled} />
            </div>

            <Button
              size="lg"
              onClick={() => isListening ? stopListening() : startListening(currentMode)}
              className={isListening ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}
            >
              {isListening ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
              {isListening ? "停止监听" : "开始监听"}
            </Button>
          </div>
        </div>

        {isListening && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStealthMode(true)}
            className="border-slate-600 text-slate-400 hover:text-white"
          >
            <EyeOff className="w-4 h-4 mr-2" />
            进入隐身模式
          </Button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">活跃会话</p>
                  <p className="text-2xl font-bold text-white">{stats?.activeSessions || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">转写文本</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalTranscripts || 0}</p>
                </div>
                <MessageCircle className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">提取实体</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalEntities || 0}</p>
                </div>
                <Target className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">智能提醒</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalAlerts || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'realtime' | 'history')} className="w-full">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="realtime" className="data-[state=active]:bg-amber-500">
              <Mic className="w-4 h-4 mr-2" />
              实时监听
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-amber-500">
              <Clock className="w-4 h-4 mr-2" />
              历史记录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-amber-400" />
                  实时监听
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <CircularWaveform isActive={isListening} volumeLevel={volumeLevel} size={80} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">音量电平</span>
                        <span className="text-slate-300 text-sm">{Math.round(volumeLevel * 100)}%</span>
                      </div>
                      <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          animate={{ width: `${volumeLevel * 100}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>

                    <div className={`w-4 h-4 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                  </div>

                  <AudioWaveform
                    isActive={isListening}
                    volumeLevel={volumeLevel}
                    barCount={48}
                    height={80}
                    gradientColors={["#22c55e", "#f59e0b"]}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {modes.map((mode) => {
                    const IconComponent = MODE_ICONS[mode.icon] || MessageCircle;
                    const isActive = currentMode === mode.id;
                    return (
                      <Button
                        key={mode.id}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setCurrentMode(mode.id);
                          if (isListening && currentSession) {
                            stopListening();
                            setTimeout(() => startListening(mode.id), 500);
                          }
                        }}
                        className={isActive ? MODE_COLORS[mode.id] : "border-slate-600 text-slate-300"}
                      >
                        <IconComponent className="w-4 h-4 mr-1" />
                        {mode.name}
                      </Button>
                    );
                  })}
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 min-h-[120px]">
                  <p className="text-slate-400 text-sm mb-2">实时转写</p>
                  <p className="text-white">
                    {transcript || (isListening ? "正在监听..." : "点击开始监听以查看转写内容")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  场景分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats?.modeDistribution || {}).map(([mode, count]) => (
                    <div key={mode} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${MODE_COLORS[mode as ListeningMode]}`} />
                      <span className="text-slate-300 flex-1">{mode}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  隐蔽反馈
                </CardTitle>
                <CardDescription className="text-slate-400">
                  配置紧急提醒通道
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Headphones className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-white text-sm">蓝牙耳机</p>
                      <p className="text-slate-500 text-xs">耳语提示</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600">优先级 1</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Watch className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm">智能手表</p>
                      <p className="text-slate-500 text-xs">震动暗号</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-600">优先级 2</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-white text-sm">手机</p>
                      <p className="text-slate-500 text-xs">静音震动</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-600">优先级 3</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mic className="w-5 h-5 text-amber-400" />
                  唤醒词设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-slate-400 text-sm mb-2">主唤醒词</p>
                  <p className="text-xl font-bold text-amber-400">"小星"</p>
                </div>

                <div>
                  <p className="text-slate-400 text-sm mb-2">备用唤醒词</p>
                  <div className="flex flex-wrap gap-2">
                    {['小星小星', '嘿小星', '星星'].map(word => (
                      <Badge key={word} variant="outline" className="border-slate-600 text-slate-300">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-slate-400 text-sm mb-2">灵敏度: {Math.round(sensitivity[0] * 100)}%</p>
                  <Slider
                    value={sensitivity}
                    onValueChange={setSensitivity}
                    min={0.3}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {currentSession && (
              <Card className="bg-slate-800/50 border-slate-700 border-amber-500/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-green-400" />
                    当前会话
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">会话ID</span>
                    <span className="text-slate-300 font-mono text-xs">{currentSession.id.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">模式</span>
                    <Badge className={MODE_COLORS[currentSession.mode]}>{currentSession.mode}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">转写数</span>
                    <span className="text-white">{currentSession.transcriptCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">实体数</span>
                    <span className="text-white">{currentSession.entityCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">提醒数</span>
                    <span className="text-white">{currentSession.alertCount}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    监听历史
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    点击会话查看详细转写内容
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {historyData?.sessions && historyData.sessions.length > 0 ? (
                      <div className="space-y-3">
                        {historyData.sessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={() => setSelectedSessionId(session.id)}
                            className={`p-4 rounded-lg cursor-pointer transition-colors ${
                              selectedSessionId === session.id
                                ? 'bg-amber-500/20 border border-amber-500/50'
                                : 'bg-slate-900/50 hover:bg-slate-700/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={MODE_COLORS[session.mode as ListeningMode] || 'bg-gray-500'}>
                                {session.mode}
                              </Badge>
                              <span className="text-slate-400 text-xs">
                                {new Date(session.startTime).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-300">
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {session.transcriptCount} 条转写
                              </span>
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {session.entityCount} 个实体
                              </span>
                            </div>
                            {session.endTime && (
                              <p className="text-slate-500 text-xs mt-2">
                                时长: {Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)} 分钟
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>暂无监听历史</p>
                        <p className="text-sm mt-2">开始监听后将在此显示历史记录</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                    转写内容
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {selectedSessionId ? '选中会话的转写文本' : '请先选择一个会话'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {selectedSessionId && sessionTranscripts?.transcripts ? (
                      sessionTranscripts.transcripts.length > 0 ? (
                        <div className="space-y-4">
                          {sessionTranscripts.transcripts.map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 rounded-lg ${
                                item.isMaster
                                  ? 'bg-amber-500/10 border-l-2 border-amber-500'
                                  : 'bg-slate-900/50 border-l-2 border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-medium ${item.isMaster ? 'text-amber-400' : 'text-slate-300'}`}>
                                  {item.speakerName || (item.isMaster ? '主人' : '其他人')}
                                </span>
                                <span className="text-slate-500 text-xs">
                                  {new Date(item.startTime * 1000).toLocaleTimeString('zh-CN')}
                                </span>
                              </div>
                              <p className="text-white">{item.text}</p>
                              {item.keywords && item.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {item.keywords.map((kw, i) => (
                                    <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-400">
                                      {kw}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-400">
                          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>此会话暂无转写内容</p>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>选择左侧会话查看转写内容</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {selectedSessionId && (
              <Card className="bg-slate-800/50 border-slate-700 mt-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-400" />
                    识别的实体 - 采纳建议
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    点击采纳将信息同步到联系人或项目系统
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sessionEntities?.entities && sessionEntities.entities.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sessionEntities.entities.map((entity) => {
                        const EntityIcon = {
                          PERSON: User,
                          ORGANIZATION: Building,
                          TOPIC: MessageCircle,
                          COMMITMENT: CheckCircle2,
                          CONFLICT: AlertCircle,
                          OPPORTUNITY: Lightbulb,
                          DEADLINE: CalendarClock,
                          MONEY: DollarSign,
                        }[entity.type] || Target;

                        const canAdoptPerson = ['PERSON', 'ORGANIZATION'].includes(entity.type);
                        const canAdoptProject = ['TOPIC', 'OPPORTUNITY', 'COMMITMENT'].includes(entity.type);
                        const isLinked = entity.linkedPersonId || entity.linkedOrganizationId;

                        return (
                          <div
                            key={entity.id}
                            className={`p-4 rounded-lg border ${
                              isLinked
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-slate-900/50 border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <EntityIcon className={`w-4 h-4 ${
                                  entity.type === 'PERSON' ? 'text-blue-400' :
                                  entity.type === 'ORGANIZATION' ? 'text-purple-400' :
                                  entity.type === 'OPPORTUNITY' ? 'text-green-400' :
                                  entity.type === 'MONEY' ? 'text-yellow-400' :
                                  entity.type === 'DEADLINE' ? 'text-red-400' :
                                  'text-slate-400'
                                }`} />
                                <Badge variant="outline" className="text-xs border-slate-600">
                                  {entity.type === 'PERSON' ? '人物' :
                                   entity.type === 'ORGANIZATION' ? '组织' :
                                   entity.type === 'TOPIC' ? '话题' :
                                   entity.type === 'COMMITMENT' ? '承诺' :
                                   entity.type === 'CONFLICT' ? '冲突' :
                                   entity.type === 'OPPORTUNITY' ? '商机' :
                                   entity.type === 'DEADLINE' ? '截止日期' :
                                   entity.type === 'MONEY' ? '金额' : entity.type}
                                </Badge>
                              </div>
                              {isLinked && (
                                <Badge className="bg-green-500/20 text-green-400 text-xs">
                                  已采纳
                                </Badge>
                              )}
                            </div>
                            <p className="text-white font-medium mb-1">{entity.value}</p>
                            {entity.context && (
                              <p className="text-slate-400 text-sm mb-2 line-clamp-2">{entity.context}</p>
                            )}
                            {entity.relatedSpeaker && (
                              <p className="text-slate-500 text-xs mb-2">相关人: {entity.relatedSpeaker}</p>
                            )}
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-slate-500 text-xs">置信度: {Math.round(entity.confidence * 100)}%</span>
                              <span className="text-slate-500 text-xs">重要性: {Math.round(entity.importance * 100)}%</span>
                            </div>

                            {!isLinked && (canAdoptPerson || canAdoptProject) && (
                              <div className="flex gap-2">
                                {canAdoptPerson && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                                    onClick={() => adoptEntityMutation.mutate({ entityId: entity.id, targetType: 'person' })}
                                    disabled={adoptEntityMutation.isPending}
                                  >
                                    <User className="w-3 h-3 mr-1" />
                                    添加联系人
                                  </Button>
                                )}
                                {canAdoptProject && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                                    onClick={() => adoptEntityMutation.mutate({ entityId: entity.id, targetType: 'project' })}
                                    disabled={adoptEntityMutation.isPending}
                                  >
                                    <Briefcase className="w-3 h-3 mr-1" />
                                    创建项目
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>此会话暂无识别的实体</p>
                      <p className="text-sm mt-2">实体包括人物、组织、话题、商机、承诺等</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
