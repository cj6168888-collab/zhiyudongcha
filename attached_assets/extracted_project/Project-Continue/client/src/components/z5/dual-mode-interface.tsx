import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Mic, MicOff, Sparkles, User, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useZ3Store } from '@/lib/z3/spirit-core';

type ViewMode = 'BUBBLE' | 'AVATAR';

interface DualModeInterfaceProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  hp: number;
  level: number;
  onVoiceRecord?: () => void;
  onFileDrop?: (file: File) => void;
}

export function DualModeInterface({ 
  mode, 
  onModeChange, 
  hp, 
  level,
  onVoiceRecord,
  onFileDrop 
}: DualModeInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathPhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  const breathScale = 1 + Math.sin(breathPhase * Math.PI / 180) * 0.05;
  const breathOpacity = 0.7 + Math.sin(breathPhase * Math.PI / 180) * 0.3;
  
  const handleLongPress = () => {
    setIsRecording(true);
    onVoiceRecord?.();
  };
  
  const handleLongPressEnd = () => {
    setIsRecording(false);
  };
  
  const handleDragStart = () => {
    setIsDragging(true);
  };
  
  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false);
  };
  
  const getFatigueLevel = () => {
    if (hp > 70) return 'energetic';
    if (hp > 40) return 'normal';
    if (hp > 20) return 'tired';
    return 'exhausted';
  };
  
  const getAvatarExpression = () => {
    const fatigue = getFatigueLevel();
    switch (fatigue) {
      case 'energetic': return '✨';
      case 'normal': return '😊';
      case 'tired': return '😔';
      case 'exhausted': return '😩';
    }
  };
  
  return (
    <div className="relative w-full h-full flex items-center justify-center" data-testid="dual-mode-interface">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant={mode === 'BUBBLE' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('BUBBLE')}
          data-testid="button-mode-bubble"
        >
          <MessageCircle className="w-4 h-4 mr-1" />
          商务气泡
        </Button>
        <Button
          variant={mode === 'AVATAR' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('AVATAR')}
          data-testid="button-mode-avatar"
        >
          <User className="w-4 h-4 mr-1" />
          二次元
        </Button>
      </div>
      
      <AnimatePresence mode="wait">
        {mode === 'BUBBLE' ? (
          <motion.div
            key="bubble"
            ref={bubbleRef}
            className="relative cursor-pointer select-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            drag
            dragControls={dragControls}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            whileTap={{ scale: 0.95 }}
            onMouseDown={(e) => {
              const timeout = setTimeout(handleLongPress, 500);
              const handleUp = () => {
                clearTimeout(timeout);
                handleLongPressEnd();
                window.removeEventListener('mouseup', handleUp);
              };
              window.addEventListener('mouseup', handleUp);
            }}
            data-testid="bubble-avatar"
          >
            <motion.div
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center",
                "bg-gradient-to-br from-cyan-400 to-blue-600",
                "shadow-lg shadow-cyan-500/50",
                isRecording && "ring-4 ring-red-500 ring-opacity-75"
              )}
              animate={{
                scale: breathScale,
                opacity: breathOpacity,
              }}
              transition={{ duration: 0.1 }}
            >
              <div className="text-4xl">
                {isRecording ? <Mic className="w-12 h-12 text-white animate-pulse" /> : '智'}
              </div>
            </motion.div>
            
            <motion.div
              className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-full text-xs">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-amber-400">Lv.{level}</span>
                <span className="text-slate-400">|</span>
                <span className={cn(
                  hp > 50 ? 'text-green-400' : hp > 25 ? 'text-amber-400' : 'text-red-400'
                )}>
                  HP {hp}%
                </span>
              </div>
            </motion.div>
            
            {isDragging && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-40 h-40 border-2 border-dashed border-cyan-400 rounded-full animate-pulse" />
              </motion.div>
            )}
            
            {isRecording && (
              <motion.p
                className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-sm text-cyan-400"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                🎙️ 语音速记中...
              </motion.p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="avatar"
            className="relative"
            initial={{ scale: 0, opacity: 0, rotateY: -90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0, opacity: 0, rotateY: 90 }}
            transition={{ type: 'spring', damping: 20 }}
            data-testid="anime-avatar"
          >
            <div className={cn(
              "w-48 h-64 rounded-2xl overflow-hidden",
              "bg-gradient-to-b from-slate-700 to-slate-900",
              "border-2 border-slate-600",
              "shadow-xl shadow-slate-900/50"
            )}>
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <motion.div
                  className="text-7xl mb-4"
                  animate={{
                    y: getFatigueLevel() === 'exhausted' ? [0, 2, 0] : 0,
                  }}
                  transition={{
                    duration: 2,
                    repeat: getFatigueLevel() === 'exhausted' ? Infinity : 0,
                  }}
                >
                  {getAvatarExpression()}
                </motion.div>
                
                <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-200">小智</h3>
                  <p className="text-xs text-slate-400">数字生命体</p>
                </div>
                
                <div className="mt-4 w-full">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>HP</span>
                    <span>{hp}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        hp > 50 ? 'bg-green-500' : hp > 25 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${hp}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                
                <div className="mt-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Level {level}</span>
                </div>
              </div>
            </div>
            
            {getFatigueLevel() === 'exhausted' && (
              <motion.div
                className="absolute -top-4 left-1/2 transform -translate-x-1/2"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="text-2xl">💤</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
