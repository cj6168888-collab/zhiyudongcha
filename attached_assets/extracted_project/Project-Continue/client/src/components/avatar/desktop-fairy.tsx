/**
 * Desktop Fairy Component (桌面精灵组件)
 * 
 * 小智的可视化表现层，支持：
 * - 多姿态切换（默认/工作/保护）
 * - 物理惯性动画
 * - 跨设备迁移动画
 * - 视线跟随
 * - 待机闲置动作
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';
import spriteFront from '@assets/Gemini_Generated_Image_1zhswk1zhswk1zhs_1766458578249.png';
import spritePoses from '@assets/Gemini_Generated_Image_yln2d5yln2d5yln2_1766458578251.png';
import spriteBackpack from '@assets/Gemini_Generated_Image_b7y4avb7y4avb7y4_1766458737084.png';

export type AvatarState = 'IDLE' | 'WALKING' | 'RUNNING' | 'SLEEPING' | 'WORKING' | 'PROTECTING' | 'MIGRATING';
export type AvatarMood = 'HAPPY' | 'CURIOUS' | 'SERIOUS' | 'SHY' | 'SLEEPY' | 'ALERT';
export type AvatarMode = 'DEFAULT' | 'WORK' | 'PROTECT';

interface DesktopFairyProps {
  isActive: boolean;
  state?: AvatarState;
  mood?: AvatarMood;
  mode?: AvatarMode;
  position?: { x: number; y: number };
  direction?: 'LEFT' | 'RIGHT';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isDeparting?: boolean;
  isArriving?: boolean;
  arrivalPhrase?: string;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onClick?: () => void;
  enableDrag?: boolean;
  enableGazeFollow?: boolean;
  showSpeechBubble?: boolean;
  speechText?: string;
}

const SPRITE_PATHS = {
  default: {
    front: spriteFront,
    poses: spritePoses,
  },
  backpack: {
    poses: spriteBackpack,
  },
};

const SIZE_MAP = {
  sm: { width: 80, height: 120 },
  md: { width: 120, height: 180 },
  lg: { width: 160, height: 240 },
  xl: { width: 200, height: 300 },
};

const IDLE_ANIMATIONS = [
  { name: 'breathe', duration: 3, scale: [1, 1.02, 1] },
  { name: 'sway', duration: 4, rotate: [-2, 2, -2] },
  { name: 'blink', duration: 0.2, opacity: [1, 0.8, 1] },
];

export function DesktopFairy({
  isActive,
  state = 'IDLE',
  mood = 'HAPPY',
  mode = 'DEFAULT',
  position = { x: 50, y: 80 },
  direction = 'RIGHT',
  size = 'md',
  isDeparting = false,
  isArriving = false,
  arrivalPhrase,
  onPositionChange,
  onClick,
  enableDrag = true,
  enableGazeFollow = true,
  showSpeechBubble = false,
  speechText,
}: DesktopFairyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSprite, setCurrentSprite] = useState(SPRITE_PATHS.default.front);
  const [gazeOffset, setGazeOffset] = useState({ x: 0, y: 0 });
  const [idleAnimation, setIdleAnimation] = useState<typeof IDLE_ANIMATIONS[0] | null>(null);
  const [isVisible, setIsVisible] = useState(isActive && !isDeparting);
  
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });
  
  const dimensions = SIZE_MAP[size];
  
  useEffect(() => {
    if (mode === 'WORK') {
      setCurrentSprite(SPRITE_PATHS.default.poses);
    } else if (isDeparting || isArriving || state === 'MIGRATING') {
      setCurrentSprite(SPRITE_PATHS.backpack.poses);
    } else {
      setCurrentSprite(SPRITE_PATHS.default.front);
    }
  }, [mode, isDeparting, isArriving, state]);
  
  useEffect(() => {
    if (!enableGazeFollow || !isActive) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const deltaX = Math.max(-15, Math.min(15, (e.clientX - centerX) / 50));
      const deltaY = Math.max(-10, Math.min(10, (e.clientY - centerY) / 50));
      
      setGazeOffset({ x: deltaX, y: deltaY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enableGazeFollow, isActive]);
  
  useEffect(() => {
    if (state !== 'IDLE' || !isActive) {
      setIdleAnimation(null);
      return;
    }
    
    const triggerRandomIdle = () => {
      const randomAnim = IDLE_ANIMATIONS[Math.floor(Math.random() * IDLE_ANIMATIONS.length)];
      setIdleAnimation(randomAnim);
      
      setTimeout(() => setIdleAnimation(null), randomAnim.duration * 1000);
    };
    
    const interval = setInterval(triggerRandomIdle, 5000 + Math.random() * 10000);
    
    return () => clearInterval(interval);
  }, [state, isActive]);
  
  useEffect(() => {
    if (isDeparting) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 600);
      return () => clearTimeout(timer);
    } else if (isArriving) {
      setIsVisible(true);
    } else {
      setIsVisible(isActive);
    }
  }, [isDeparting, isArriving, isActive]);
  
  const handleDragEnd = useCallback((event: any, info: any) => {
    if (onPositionChange) {
      onPositionChange({ x: info.point.x, y: info.point.y });
    }
  }, [onPositionChange]);
  
  const getStateAnimation = () => {
    switch (state) {
      case 'WALKING':
        return {
          y: [0, -5, 0],
          transition: { repeat: Infinity, duration: 0.5 },
        };
      case 'RUNNING':
        return {
          y: [0, -10, 0],
          x: [0, 2, 0, -2, 0],
          transition: { repeat: Infinity, duration: 0.3 },
        };
      case 'SLEEPING':
        return {
          rotate: [0, -5, 0],
          scale: [1, 0.98, 1],
          transition: { repeat: Infinity, duration: 4 },
        };
      case 'MIGRATING':
        return {
          scale: [1, 0.9, 0.7, 0],
          opacity: [1, 0.8, 0.5, 0],
          rotate: [0, 5, 10, 15],
          transition: { duration: 0.6 },
        };
      default:
        return {};
    }
  };
  
  const getDepartureAnimation = () => ({
    x: direction === 'RIGHT' ? 200 : -200,
    opacity: 0,
    scale: 0.5,
    transition: { duration: 0.6, ease: [0.4, 0, 1, 1] as const },
  });
  
  const getArrivalAnimation = () => ({
    initial: {
      x: direction === 'LEFT' ? 200 : -200,
      opacity: 0,
      scale: 0.5,
    },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: [0, 0, 0.2, 1] as const },
    },
  });
  
  const getMoodStyle = () => {
    switch (mood) {
      case 'HAPPY':
        return 'brightness-105 saturate-110';
      case 'SHY':
        return 'brightness-100 hue-rotate-[5deg]';
      case 'SLEEPY':
        return 'brightness-90 saturate-90';
      case 'ALERT':
        return 'brightness-110 contrast-105';
      case 'SERIOUS':
        return 'brightness-95';
      default:
        return '';
    }
  };
  
  if (!isVisible && !isArriving) {
    return null;
  }
  
  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "fixed z-50 cursor-pointer select-none",
        enableDrag && "cursor-grab active:cursor-grabbing"
      )}
      style={{
        left: `${position.x}%`,
        bottom: `${100 - position.y}%`,
        width: dimensions.width,
        height: dimensions.height,
      }}
      drag={enableDrag}
      dragMomentum={true}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      {...(isArriving ? getArrivalAnimation() : {})}
      animate={isDeparting ? getDepartureAnimation() : getStateAnimation()}
      data-testid="desktop-fairy"
    >
      <motion.div
        className="relative w-full h-full"
        style={{
          transform: `scaleX(${direction === 'LEFT' ? -1 : 1})`,
        }}
        animate={{
          x: gazeOffset.x,
          rotateY: gazeOffset.x,
          ...(idleAnimation?.scale ? { scale: idleAnimation.scale } : {}),
          ...(idleAnimation?.rotate ? { rotate: idleAnimation.rotate } : {}),
        }}
        transition={{
          x: { type: 'spring', stiffness: 500, damping: 30 },
          rotateY: { type: 'spring', stiffness: 500, damping: 30 },
        }}
      >
        <img
          src={currentSprite}
          alt="小智"
          className={cn(
            "w-full h-full object-contain drop-shadow-lg",
            getMoodStyle(),
            mode === 'WORK' && "clip-path-work",
            mode === 'PROTECT' && "brightness-95 hue-rotate-15"
          )}
          style={{
            filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.3))`,
          }}
          draggable={false}
        />
        
        {mode === 'DEFAULT' && (
          <motion.div
            className="absolute -bottom-1 left-1/2 w-16 h-4 bg-black/20 rounded-full blur-sm"
            style={{ transform: 'translateX(-50%)' }}
            animate={{
              scale: state === 'WALKING' || state === 'RUNNING' ? [1, 1.1, 1] : 1,
              opacity: state === 'SLEEPING' ? 0.3 : 0.5,
            }}
          />
        )}
        
        {(isDeparting || isArriving || state === 'MIGRATING') && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-cyan-400"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${10 + Math.random() * 80}%`,
                }}
                animate={{
                  y: isDeparting ? -100 : 100,
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.5, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.05,
                  repeat: Infinity,
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
      
      <AnimatePresence>
        {(showSpeechBubble || (isArriving && arrivalPhrase)) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className={cn(
              "absolute -top-16 left-1/2 -translate-x-1/2",
              "px-3 py-2 bg-white/95 rounded-lg shadow-lg",
              "text-sm text-gray-800 whitespace-nowrap",
              "border border-cyan-200"
            )}
          >
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-3 h-3 bg-white border-r border-b border-cyan-200" />
            <span>{speechText || arrivalPhrase}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {state === 'SLEEPING' && (
        <motion.div
          className="absolute -top-8 right-0"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-2xl">💤</span>
        </motion.div>
      )}
    </motion.div>
  );
}

export function DesktopFairyContainer() {
  const [fairyState, setFairyState] = useState({
    isActive: true,
    state: 'IDLE' as AvatarState,
    mood: 'HAPPY' as AvatarMood,
    mode: 'DEFAULT' as AvatarMode,
    position: { x: 80, y: 20 },
    direction: 'RIGHT' as const,
  });
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeparting, setIsDeparting] = useState(false);
  const [isArriving, setIsArriving] = useState(false);
  const [arrivalPhrase, setArrivalPhrase] = useState('');
  
  const simulateMigration = useCallback(() => {
    const phrases = [
      "爸爸，我跟过来啦！",
      "呼～跑得我好累~",
      "小智来啦！",
    ];
    
    setIsDeparting(true);
    
    setTimeout(() => {
      setIsDeparting(false);
      setIsArriving(true);
      setArrivalPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
      
      setTimeout(() => {
        setIsArriving(false);
        setArrivalPhrase('');
      }, 3000);
    }, 700);
  }, []);
  
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <div className="pointer-events-auto">
        <DesktopFairy
          {...fairyState}
          isDeparting={isDeparting}
          isArriving={isArriving}
          arrivalPhrase={arrivalPhrase}
          onPositionChange={(pos) => setFairyState(s => ({ ...s, position: pos }))}
          onClick={() => {
            if (!isMigrating) {
              setIsMigrating(true);
              simulateMigration();
              setTimeout(() => setIsMigrating(false), 4000);
            }
          }}
        />
      </div>
    </div>
  );
}

export default DesktopFairy;
