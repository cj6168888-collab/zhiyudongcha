import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Eye, EyeOff, Upload, FileText, Sparkles, 
  AlertCircle, CheckCircle, Clock, Brain, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type EmotionState = 'calm' | 'alert' | 'warning' | 'danger' | 'success' | 'thinking';

interface ParticleConfig {
  color: string;
  speed: number;
  intensity: number;
  breathingRate: number;
}

interface KeywordResult {
  keywords: string[];
  summary: string;
  riskLevel: number;
  emotionState: EmotionState;
}

const EMOTION_COLORS: Record<EmotionState, string> = {
  danger: '#ff4444',
  warning: '#ff8800',
  alert: '#ffcc00',
  thinking: '#00ccff',
  success: '#44ff88',
  calm: '#6699ff',
};

const EMOTION_LABELS: Record<EmotionState, string> = {
  danger: '高风险',
  warning: '警告',
  alert: '注意',
  thinking: '分析中',
  success: '安全',
  calm: '平静',
};

function ParticleCloud({ emotion, isActive }: { emotion: EmotionState; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
  }>>([]);
  const animationRef = useRef<number | undefined>(undefined);

  const getConfig = useCallback((): ParticleConfig => {
    switch (emotion) {
      case 'danger':
        return { color: '#ff4444', speed: 2.5, intensity: 1.0, breathingRate: 0.3 };
      case 'warning':
        return { color: '#ff8800', speed: 1.8, intensity: 0.8, breathingRate: 0.5 };
      case 'alert':
        return { color: '#ffcc00', speed: 1.2, intensity: 0.6, breathingRate: 0.7 };
      case 'thinking':
        return { color: '#00ccff', speed: 1.0, intensity: 0.5, breathingRate: 1.0 };
      case 'success':
        return { color: '#44ff88', speed: 0.8, intensity: 0.4, breathingRate: 1.5 };
      case 'calm':
      default:
        return { color: '#6699ff', speed: 0.5, intensity: 0.3, breathingRate: 2.0 };
    }
  }, [emotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const config = getConfig();
    const particleCount = Math.floor(50 * config.intensity);

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * config.speed,
          vy: (Math.random() - 0.5) * config.speed,
          size: Math.random() * 4 + 2,
          alpha: Math.random() * 0.5 + 0.3,
        });
      }
    }

    let breathPhase = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      
      breathPhase += config.breathingRate * 0.02;
      const breathScale = 1 + Math.sin(breathPhase) * 0.2;

      for (const p of particlesRef.current) {
        p.x += p.vx * (isActive ? 1 : 0.3);
        p.y += p.vy * (isActive ? 1 : 0.3);

        if (p.x < 0 || p.x > canvas.offsetWidth) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.vy *= -1;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * breathScale);
        gradient.addColorStop(0, config.color);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * breathScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = p.alpha * (isActive ? 1 : 0.5);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [emotion, isActive, getConfig]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      data-testid="particle-canvas"
    />
  );
}

function GlassContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "backdrop-blur-xl bg-slate-900/40 border border-slate-700/50 rounded-2xl shadow-2xl",
        className
      )}
      data-testid="glass-container"
    >
      {children}
    </div>
  );
}

function KeywordTag({ keyword, index }: { keyword: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Badge
        variant="secondary"
        className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 px-3 py-1.5 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
        data-testid={`keyword-tag-${index}`}
      >
        {keyword}
      </Badge>
    </motion.div>
  );
}

function EmotionIndicator({ emotion, riskLevel }: { emotion: EmotionState; riskLevel: number }) {
  const color = EMOTION_COLORS[emotion];
  const label = EMOTION_LABELS[emotion];

  const Icon = emotion === 'danger' ? AlertCircle :
    emotion === 'warning' ? AlertCircle :
    emotion === 'success' ? CheckCircle :
    emotion === 'thinking' ? Brain : Shield;

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-2 rounded-full"
      style={{ backgroundColor: `${color}20`, borderColor: `${color}50` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="emotion-indicator"
    >
      <Icon className="w-5 h-5" style={{ color }} />
      <span className="text-sm font-medium" style={{ color }}>
        {label}
      </span>
      <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${riskLevel}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="text-xs text-slate-400">{riskLevel}%</span>
    </motion.div>
  );
}

export default function InterfaceXPage() {
  const [, setLocation] = useLocation();
  const [inputText, setInputText] = useState("");
  const [stealthMode, setStealthMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<KeywordResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    text: string;
    result: KeywordResult;
    timestamp: number;
  }>>([]);

  const { data: status } = useQuery({
    queryKey: ['/api/interface-x/status'],
    refetchInterval: 5000,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest('POST', '/api/interface-x/analyze', { text });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentResult(data);
      setAnalysisHistory(prev => [{
        text: inputText.substring(0, 100),
        result: data,
        timestamp: Date.now(),
      }, ...prev.slice(0, 9)]);
    },
  });

  const handleAnalyze = async () => {
    if (!inputText.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await analyzeMutation.mutateAsync(inputText);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setInputText(text.substring(0, 5000));
    };
    reader.readAsText(file);
  };

  const emotionState = currentResult?.emotionState || 'calm';
  const riskLevel = currentResult?.riskLevel || 0;

  return (
    <div 
      className={cn(
        "min-h-screen relative overflow-hidden transition-opacity duration-500",
        stealthMode ? "opacity-10" : "opacity-100"
      )}
      data-testid="interface-x-page"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      <ParticleCloud emotion={emotionState} isActive={!stealthMode} />

      <div className="relative z-10 p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/')}
              className="text-slate-400 hover:text-white"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                Interface-X 透明驾驶舱
              </h1>
              <p className="text-sm text-slate-400">实时文档分析 · 关键词提取 · 风险评估</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <EmotionIndicator emotion={emotionState} riskLevel={riskLevel} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStealthMode(!stealthMode)}
              className={cn(
                "transition-colors",
                stealthMode ? "text-red-400" : "text-slate-400 hover:text-white"
              )}
              data-testid="button-stealth"
            >
              {stealthMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <GlassContainer className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">文本输入</span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="粘贴文档、合同、邮件内容进行智能分析..."
                className="w-full h-40 bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                data-testid="input-text"
              />
              <div className="flex items-center justify-between mt-3">
                <label htmlFor="file-upload-x" className="flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">上传文件</span>
                  <input
                    id="file-upload-x"
                    type="file"
                    accept=".txt,.md,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file"
                    aria-label="上传文件"
                  />
                </label>
                <Button
                  onClick={handleAnalyze}
                  disabled={!inputText.trim() || isAnalyzing}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      智能分析
                    </>
                  )}
                </Button>
              </div>
            </GlassContainer>

            <AnimatePresence>
              {currentResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <GlassContainer className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      <span className="text-white font-medium">关键词面板</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4" data-testid="keywords-panel">
                      {currentResult.keywords.map((keyword, i) => (
                        <KeywordTag key={i} keyword={keyword} index={i} />
                      ))}
                    </div>

                    {currentResult.summary && (
                      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <span className="text-sm text-slate-400">摘要: </span>
                        <span className="text-white" data-testid="text-summary">
                          {currentResult.summary}
                        </span>
                      </div>
                    )}
                  </GlassContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-4">
            <GlassContainer className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">状态监控</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">情绪状态</span>
                  <Badge
                    style={{ 
                      backgroundColor: `${EMOTION_COLORS[emotionState]}20`,
                      color: EMOTION_COLORS[emotionState],
                      borderColor: `${EMOTION_COLORS[emotionState]}50`
                    }}
                    data-testid="badge-emotion"
                  >
                    {EMOTION_LABELS[emotionState]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">风险评分</span>
                  <span className="text-white font-mono" data-testid="text-risk-score">{riskLevel}/100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">隐身模式</span>
                  <Badge variant={stealthMode ? "destructive" : "secondary"} data-testid="badge-stealth">
                    {stealthMode ? "已激活" : "未激活"}
                  </Badge>
                </div>
              </div>
            </GlassContainer>

            <GlassContainer className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">分析历史</span>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {analysisHistory.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">暂无分析记录</p>
                  ) : (
                    analysisHistory.map((item, i) => (
                      <div
                        key={i}
                        className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors"
                        onClick={() => setCurrentResult(item.result)}
                        data-testid={`history-item-${i}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ 
                              color: EMOTION_COLORS[item.result.emotionState],
                              borderColor: EMOTION_COLORS[item.result.emotionState]
                            }}
                          >
                            {EMOTION_LABELS[item.result.emotionState]}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {item.text}...
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </GlassContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
