import { useEffect, useState, useMemo } from 'react';
import { useZ1Store, MAX_HP } from '@/lib/z1/god-protocol';
import { cn } from '@/lib/utils';
import { 
  Heart, Zap, Coffee, Moon, Sparkles, 
  AlertTriangle, Battery, BatteryLow, BatteryWarning,
  Smile, Frown, Meh
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type SpriteState = 
  | 'IDLE' 
  | 'HAPPY' 
  | 'WORKING' 
  | 'TIRED' 
  | 'WEAK' 
  | 'DANCE' 
  | 'SLEEP' 
  | 'ALERT'
  | 'WAVE';

export interface SpriteEmpathyProps {
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onStateChange?: (state: SpriteState) => void;
  className?: string;
}

const STATE_COLORS: Record<SpriteState, string> = {
  IDLE: 'from-cyan-400 to-blue-500',
  HAPPY: 'from-green-400 to-emerald-500',
  WORKING: 'from-amber-400 to-orange-500',
  TIRED: 'from-purple-400 to-violet-500',
  WEAK: 'from-red-400 to-rose-500',
  DANCE: 'from-pink-400 to-fuchsia-500',
  SLEEP: 'from-indigo-400 to-blue-600',
  ALERT: 'from-red-500 to-orange-500',
  WAVE: 'from-teal-400 to-cyan-500',
};

const STATE_ICONS: Record<SpriteState, React.ReactNode> = {
  IDLE: <Meh className="w-full h-full" />,
  HAPPY: <Smile className="w-full h-full" />,
  WORKING: <Zap className="w-full h-full" />,
  TIRED: <Coffee className="w-full h-full" />,
  WEAK: <Frown className="w-full h-full" />,
  DANCE: <Sparkles className="w-full h-full" />,
  SLEEP: <Moon className="w-full h-full" />,
  ALERT: <AlertTriangle className="w-full h-full" />,
  WAVE: <Heart className="w-full h-full" />,
};

const STATE_MESSAGES: Record<SpriteState, string> = {
  IDLE: '待命中...',
  HAPPY: '状态良好！',
  WORKING: '处理中...',
  TIRED: '需要休息',
  WEAK: 'HP不足！',
  DANCE: '庆祝模式',
  SLEEP: '梦境模式',
  ALERT: '紧急状态',
  WAVE: '欢迎主人',
};

const SIZE_MAP = {
  sm: { container: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-[10px]' },
  md: { container: 'w-20 h-20', icon: 'w-10 h-10', text: 'text-xs' },
  lg: { container: 'w-32 h-32', icon: 'w-16 h-16', text: 'text-sm' },
};

export function SpriteEmpathy({ 
  size = 'md', 
  showStatus = true,
  onStateChange,
  className 
}: SpriteEmpathyProps) {
  const { hpBalance, role, isConnected } = useZ1Store();
  const [currentState, setCurrentState] = useState<SpriteState>('IDLE');
  const [isHovered, setIsHovered] = useState(false);
  
  const hpPercent = (hpBalance / MAX_HP) * 100;
  const sizeConfig = SIZE_MAP[size];

  const computedState = useMemo((): SpriteState => {
    if (!isConnected) return 'SLEEP';
    if (hpPercent < 10) return 'WEAK';
    if (hpPercent < 20) return 'TIRED';
    if (hpPercent < 40) return 'IDLE';
    if (hpPercent > 80) return 'HAPPY';
    return 'WORKING';
  }, [hpPercent, isConnected]);

  useEffect(() => {
    if (currentState !== computedState) {
      setCurrentState(computedState);
      onStateChange?.(computedState);
    }
  }, [computedState, currentState, onStateChange]);

  const getBatteryIcon = () => {
    if (hpPercent < 20) return <BatteryLow className="w-4 h-4 text-red-500" />;
    if (hpPercent < 50) return <BatteryWarning className="w-4 h-4 text-amber-500" />;
    return <Battery className="w-4 h-4 text-green-500" />;
  };

  const getAnimationVariants = () => {
    switch (currentState) {
      case 'DANCE':
        return {
          animate: { 
            rotate: [0, -10, 10, -10, 0],
            scale: [1, 1.1, 1, 1.1, 1],
          },
          transition: { duration: 0.5, repeat: Infinity }
        };
      case 'SLEEP':
        return {
          animate: { scale: [1, 0.95, 1], opacity: [1, 0.7, 1] },
          transition: { duration: 2, repeat: Infinity }
        };
      case 'WEAK':
        return {
          animate: { y: [0, 2, 0], opacity: [1, 0.6, 1] },
          transition: { duration: 1.5, repeat: Infinity }
        };
      case 'WORKING':
        return {
          animate: { rotate: [0, 5, -5, 0] },
          transition: { duration: 0.3, repeat: Infinity }
        };
      case 'WAVE':
        return {
          animate: { rotate: [0, 20, 0, 20, 0] },
          transition: { duration: 0.8, repeat: 3 }
        };
      default:
        return {
          animate: { scale: [1, 1.02, 1] },
          transition: { duration: 2, repeat: Infinity }
        };
    }
  };

  const handleClick = () => {
    if (currentState === 'IDLE' || currentState === 'HAPPY') {
      setCurrentState('WAVE');
      setTimeout(() => setCurrentState(computedState), 2500);
    }
  };

  return (
    <div 
      className={cn("relative flex flex-col items-center gap-2", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="sprite-empathy"
    >
      <motion.div
        className={cn(
          "relative rounded-full bg-gradient-to-br p-1 cursor-pointer shadow-lg",
          sizeConfig.container,
          STATE_COLORS[currentState],
          role === 'MASTER' && 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-background'
        )}
        onClick={handleClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        {...getAnimationVariants()}
        data-testid="sprite-avatar"
      >
        <div className="absolute inset-1 rounded-full bg-background/90 flex items-center justify-center">
          <div className={cn("text-foreground", sizeConfig.icon)}>
            {STATE_ICONS[currentState]}
          </div>
        </div>
        
        {currentState === 'ALERT' && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
        
        {(currentState === 'HAPPY' || currentState === 'DANCE') && (
          <motion.div
            className="absolute -top-2 left-1/2 -translate-x-1/2"
            animate={{ y: [-5, -10, -5], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
          </motion.div>
        )}
      </motion.div>

      {showStatus && (
        <AnimatePresence>
          {(isHovered || ['WEAK', 'TIRED', 'ALERT'].includes(currentState)) && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={cn(
                "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap",
                "px-2 py-1 rounded bg-popover border border-border shadow-md",
                sizeConfig.text
              )}
            >
              <div className="flex items-center gap-1.5">
                {getBatteryIcon()}
                <span>{STATE_MESSAGES[currentState]}</span>
                <span className="text-muted-foreground">
                  {Math.round(hpPercent)}%
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
