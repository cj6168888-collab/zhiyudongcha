import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { useQuery } from "@tanstack/react-query";
import { 
  Eye, Battery, Wifi, Clock, 
  MessageCircle, Calendar, AlertTriangle,
  ChevronLeft, ChevronRight, Volume2
} from "lucide-react";

interface HudMessage {
  id: string;
  type: 'info' | 'alert' | 'task' | 'message';
  title: string;
  content: string;
  time: string;
}

export default function ArHudPage() {
  const [, setLocation] = useLocation();
  const { role, hpBalance } = useZ1Store();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [batteryLevel] = useState(85);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: messages = [] } = useQuery<HudMessage[]>({
    queryKey: ['/api/ar/messages'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/ar/messages');
        if (!res.ok) return getMockMessages();
        return res.json();
      } catch {
        return getMockMessages();
      }
    },
    refetchInterval: 5000,
  });

  const getMockMessages = (): HudMessage[] => [
    { id: '1', type: 'info', title: '系统状态', content: `HP: ${hpBalance}/1000 | 运行正常`, time: formatTime(new Date()) },
    { id: '2', type: 'task', title: '今日待办', content: '3项任务待处理', time: '09:00' },
    { id: '3', type: 'message', title: '新消息', content: '来自助手的问候', time: '10:30' },
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const nextMessage = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(messages.length, 1));
  };

  const prevMessage = () => {
    setCurrentIndex((prev) => (prev - 1 + Math.max(messages.length, 1)) % Math.max(messages.length, 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextMessage();
      if (e.key === 'ArrowLeft') prevMessage();
      if (e.key === 'Escape') setLocation('/');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages.length]);

  const currentMessage = messages[currentIndex];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'task': return <Calendar className="w-4 h-4 text-cyan-400" />;
      case 'message': return <MessageCircle className="w-4 h-4 text-green-400" />;
      default: return <Eye className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black flex flex-col font-mono select-none"
      style={{ 
        maxWidth: '640px', 
        maxHeight: '480px', 
        margin: 'auto',
        fontSize: '14px',
        lineHeight: '1.4'
      }}
      data-testid="ar-hud-page"
    >
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      <header className="flex items-center justify-between px-3 py-2 border-b border-green-500/30">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-xs font-bold tracking-wider">INMO GO3</span>
        </div>
        
        <div className="flex items-center gap-3 text-green-400 text-xs">
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1">
            <Battery className="w-3 h-3" />
            <span>{batteryLevel}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-3">
        <AnimatePresence mode="wait">
          {currentMessage && (
            <motion.div
              key={currentMessage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-md"
            >
              <div className="border border-green-500/40 rounded-lg bg-green-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {getTypeIcon(currentMessage.type)}
                  <span className="text-green-400 font-bold text-sm">
                    {currentMessage.title}
                  </span>
                  <span className="text-green-600 text-xs ml-auto">
                    {currentMessage.time}
                  </span>
                </div>
                
                <p className="text-green-300 text-base leading-relaxed">
                  {currentMessage.content}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="text-green-500/50 text-center">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>等待数据...</p>
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between px-3 py-2 border-t border-green-500/30">
        <button 
          onClick={prevMessage}
          className="flex items-center gap-1 text-green-500 hover:text-green-400 transition-colors px-2 py-1"
          data-testid="ar-prev"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs">上一条</span>
        </button>

        <div className="flex items-center gap-2">
          {messages.map((_, i) => (
            <div 
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentIndex ? 'bg-green-400' : 'bg-green-800'
              }`}
            />
          ))}
        </div>

        <button 
          onClick={nextMessage}
          className="flex items-center gap-1 text-green-500 hover:text-green-400 transition-colors px-2 py-1"
          data-testid="ar-next"
        >
          <span className="text-xs">下一条</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-green-600/50 text-xs">
        {role === 'MASTER' ? '主人模式' : '访客模式'} | HP {hpBalance}
      </div>

      <div className="fixed bottom-2 right-2 flex items-center gap-1 text-green-700 text-xs">
        <Volume2 className="w-3 h-3" />
        <span>说"小智"唤醒</span>
      </div>
    </div>
  );
}
