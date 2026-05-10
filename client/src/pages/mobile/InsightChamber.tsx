/**
 * InsightChamber - 商务聆听舱 2.0 (增强版)
 *
 * 增强：实时计时器、转写结果展示、历史记录、状态管理
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { Mic, Tag, Sparkles, BrainCircuit, Clock, FileText, ChevronRight, Trash2, Play } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface TranscriptionRecord {
  id: string;
  content: string;
  duration: number;
  createdAt: number;
  tags?: string[];
}

const Square = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
);

// WebSocket 重连配置
const WS_RECONNECT_CONFIG = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

export default function InsightChamber() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const timerInterval = useRef<NodeJS.Timeout>();

  // 获取转写历史
  const { data: historyData } = useQuery({
    queryKey: ['/api/transcriptions'],
    queryFn: async () => {
      const res = await fetch('/api/transcriptions');
      const data = await res.json();
      return data.data || data || [];
    },
  });

  // 计时器
  useEffect(() => {
    if (isRecording) {
      timerInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      timerInterval.current && clearInterval(timerInterval.current);
    }
    return () => {
      timerInterval.current && clearInterval(timerInterval.current);
    };
  }, [isRecording]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 安全的 WebSocket 连接
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}/ws/realtime-voice`);
    ws.current.binaryType = 'arraybuffer';

    ws.current.onopen = () => {
      reconnectAttempts.current = 0;
    };

    ws.current.onerror = () => toast.error("Z3 语音协议链路故障");

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript') {
          setCurrentTranscript(prev => prev + data.text);
        }
      } catch (e) {
        // 二进制数据处理
      }
    };

    ws.current.onclose = () => {
      if (reconnectAttempts.current < WS_RECONNECT_CONFIG.maxAttempts) {
        const delay = Math.min(
          WS_RECONNECT_CONFIG.baseDelay * Math.pow(2, reconnectAttempts.current),
          WS_RECONNECT_CONFIG.maxDelay
        );
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
      }
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
      ws.current?.close();
    };
  }, [connectWebSocket]);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(e.data);
        }
      };

      mediaRecorder.current.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setCurrentTranscript('');
      toast.success("吉麟正在同步您的商务会谈内容...");
    } catch (err) {
      toast.error("麦克风采集授权失败");
    }
  };

  const handleStop = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);

    // 保存转写记录
    if (currentTranscript) {
      const newRecord: TranscriptionRecord = {
        id: Date.now().toString(),
        content: currentTranscript,
        duration: recordingTime,
        createdAt: Date.now(),
      };
      setTranscriptions(prev => [newRecord, ...prev]);
    }

    toast.info("同步已封包，正在生成洞察摘要...");
    setTimeout(() => setShowResults(true), 1500);
  };

  return (
    <SafeLayout headerTitle="商务聆听舱" showBack={true} noPadding>
      <div className="h-full flex flex-col items-center justify-between px-6 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 transition-opacity duration-300" style={{ opacity: isRecording ? 1 : 0 }} />

        {/* 顶部状态 */}
        <div className="text-center z-10 w-full">
          <div className="flex justify-between items-center px-2 mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-widest">
              {isRecording ? '录音中' : '待机'}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">
              {transcriptions.length} 条记录
            </div>
          </div>
          <div className="text-5xl font-mono font-bold text-white tracking-tighter">{formatTime(recordingTime)}</div>
          <p className="text-[10px] font-black text-gray-500 mt-4 tracking-[0.3em] uppercase">{isRecording ? "Z3-VOICE Protocol Active" : "Standby for Command"}</p>
        </div>

        {/* 中间波形动画 */}
        <div className="flex-1 w-full flex items-center justify-center z-10">
          <div className="relative">
            <motion.div
              animate={{ scale: isRecording ? [1, 1.3, 1] : 1 }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-primary rounded-full blur-3xl w-48 h-48 -ml-24 -mt-24"
            />
            <div className={cn("w-36 h-36 rounded-full flex items-center justify-center border transition-all duration-500", isRecording ? "border-primary bg-primary/10 shadow-[0_0_40px_rgba(99,102,241,0.5)]" : "border-white/5 bg-white/5")}>
              <Mic className={cn("w-14 h-14", isRecording ? "text-primary animate-pulse" : "text-gray-700")} />
            </div>
          </div>
        </div>

        {/* 录音按钮 */}
        <button
          onClick={isRecording ? handleStop : handleStart}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 z-10",
            isRecording ? "bg-red-500" : "bg-primary"
          )}
        >
          {isRecording ? <Square className="fill-white w-6 h-6" /> : <Mic className="text-white w-8 h-8" />}
        </button>

        {/* 转写结果面板 */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-0 bg-[#0f172a] z-20 pt-20 pb-10 px-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">转写结果</h3>
                <button onClick={() => setShowResults(false)} className="text-gray-500">关闭</button>
              </div>

              {currentTranscript ? (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-6">
                  <p className="text-sm text-gray-300 leading-relaxed">{currentTranscript}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">暂无转写内容</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentTranscript);
                    toast.success("已复制到剪贴板");
                  }}
                  className="flex-1 py-3 rounded-2xl bg-primary text-white text-sm font-bold"
                >
                  复制文本
                </button>
                <button
                  onClick={() => {
                    setShowResults(false);
                    setCurrentTranscript('');
                  }}
                  className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm font-bold"
                >
                  新建录音
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SafeLayout>
  );
}
