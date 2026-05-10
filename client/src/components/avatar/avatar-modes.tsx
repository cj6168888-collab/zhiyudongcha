import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { visualEnhancements, type PersonaMode } from '@/lib/avatar/visual-enhancements';

type AvatarMode = 'bubble' | 'anime';

const EXPERT_TO_PERSONA: Record<string, PersonaMode> = {
  legal: 'LEGAL',
  finance: 'FINANCE',
  strategy: 'STRATEGY',
  secretary: 'SECRETARY',
  psychology: 'PSYCHOLOGY',
  planning: 'STRATEGY',
};

interface AvatarModesProps {
  mode: AvatarMode;
  hp: number;
  maxHp: number;
  onModeChange: (mode: AvatarMode) => void;
  onExpertSelect?: (expert: string) => void;
  isAuthenticated: boolean;
}

const EXPERTS = [
  { id: 'legal', name: '律师', icon: '⚖️', color: '#e91e63' },
  { id: 'finance', name: '财务', icon: '📊', color: '#4caf50' },
  { id: 'strategy', name: '策略', icon: '🎯', color: '#2196f3' },
  { id: 'secretary', name: '秘书', icon: '📋', color: '#9c27b0' },
  { id: 'psychology', name: '心理', icon: '🧠', color: '#ff9800' },
  { id: 'planning', name: '规划', icon: '📐', color: '#00bcd4' },
];

export function AvatarModes({
  mode,
  hp,
  maxHp,
  onModeChange,
  onExpertSelect,
  isAuthenticated,
}: AvatarModesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animeState, setAnimeState] = useState<'idle' | 'wave' | 'tired'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hpPercentage = (hp / maxHp) * 100;
  const hpColor = hpPercentage > 60 ? '#00bcd4' : hpPercentage > 30 ? '#ff9800' : '#f44336';

  useEffect(() => {
    // 清理之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (mode === 'anime') {
      if (hpPercentage < 20) {
        setAnimeState('tired');
      } else if (hpPercentage > 80) {
        const interval = setInterval(() => {
          setAnimeState('wave');
          timeoutRef.current = setTimeout(() => setAnimeState('idle'), 1500);
        }, 8000);

        return () => {
          clearInterval(interval);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        };
      } else {
        setAnimeState('idle');
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [mode, hpPercentage]);

  const handleBubbleClick = () => {
    if (mode === 'bubble') {
      setIsExpanded(!isExpanded);
    }
  };

  const handleExpertClick = (expertId: string) => {
    setIsExpanded(false);

    const personaMode = EXPERT_TO_PERSONA[expertId];
    if (personaMode) {
      visualEnhancements.getExpertTransformEffect(personaMode);
    }

    if (onExpertSelect) {
      onExpertSelect(expertId);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40" data-testid="avatar-modes">
      <div className="absolute -top-12 right-0 flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onModeChange('bubble')}
          className={`px-2 py-1 rounded text-xs font-mono transition-all ${
            mode === 'bubble'
              ? 'bg-cyan-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
          data-testid="mode-switch-bubble"
        >
          商务
        </Button>
        <Button
          variant="outline"
          onClick={() => onModeChange('anime')}
          className={`px-2 py-1 rounded text-xs font-mono transition-all ${
            mode === 'anime'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
          data-testid="mode-switch-anime"
        >
          二次元</Button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'bubble' ? (
          <motion.div
            key="bubble"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="relative"
            data-testid="business-bubble"
          >
            <motion.div
              className="w-16 h-16 rounded-full cursor-pointer relative"
              style={{
                background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent)`,
                backgroundColor: 'rgba(0, 188, 212, 0.15)',
                border: `2px solid ${hpColor}`,
                boxShadow: `0 0 20px ${hpColor}40, inset 0 0 20px ${hpColor}20`,
              }}
              animate={{
                boxShadow: [
                  `0 0 20px ${hpColor}40, inset 0 0 20px ${hpColor}20`,
                  `0 0 30px ${hpColor}60, inset 0 0 30px ${hpColor}30`,
                  `0 0 20px ${hpColor}40, inset 0 0 20px ${hpColor}20`,
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              onClick={handleBubbleClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl">智</span>
              </div>

              <svg className="absolute inset-0" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#333"
                  strokeWidth="3"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={hpColor}
                  strokeWidth="3"
                  strokeDasharray={`${hpPercentage * 1.76} 176`}
                  strokeLinecap="round"
                  transform="rotate(-90 32 32)"
                  className="transition-all duration-500"
                />
              </svg>
            </motion.div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute bottom-20 right-0"
                  data-testid="expert-panel"
                >
                  <div className="relative w-48 h-48">
                    {EXPERTS.map((expert, index) => {
                      const angle = (index * 60 - 90) * (Math.PI / 180);
                      const radius = 60;
                      const x = Math.cos(angle) * radius + 72;
                      const y = Math.sin(angle) * radius + 72;

                      return (
                        <motion.button
                          key={expert.id}
                          initial={{ scale: 0, x: 72, y: 72 }}
                          animate={{ scale: 1, x, y }}
                          exit={{ scale: 0, x: 72, y: 72 }}
                          transition={{ delay: index * 0.05 }}
                          className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex flex-col items-center justify-center text-white text-xs font-mono hover:scale-110 transition-transform"
                          style={{ backgroundColor: expert.color }}
                          onClick={() => handleExpertClick(expert.id)}
                          data-testid={`expert-${expert.id}`}
                        >
                          <span className="text-lg">{expert.icon}</span>
                          <span className="text-[10px]">{expert.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="anime"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="relative"
            data-testid="anime-avatar"
          >
            <motion.div
              className="w-20 h-20 rounded-2xl overflow-hidden cursor-pointer relative"
              style={{
                background: 'linear-gradient(135deg, #1a237e, #311b92)',
                border: `2px solid ${hpColor}`,
              }}
              animate={
                animeState === 'wave'
                  ? { y: [0, -10, 0], rotate: [0, 5, -5, 0] }
                  : animeState === 'tired'
                  ? { y: 0 }
                  : { y: [0, -3, 0] }
              }
              transition={
                animeState === 'wave'
                  ? { duration: 1.5 }
                  : { duration: 2, repeat: Infinity }
              }
              whileHover={{ scale: 1.05 }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {animeState === 'tired' ? (
                  <>
                    <div className="text-3xl">😴</div>
                    <div className="text-[8px] text-yellow-400 font-mono mt-1">
                      算力不足
                    </div>
                  </>
                ) : animeState === 'wave' ? (
                  <>
                    <div className="text-3xl">👋</div>
                    <div className="text-[8px] text-cyan-400 font-mono mt-1">
                      主人好~
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="text-3xl"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      ✨
                    </motion.div>
                    <div className="text-[8px] text-cyan-400 font-mono mt-1">
                      小星待命
                    </div>
                  </>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: hpColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${hpPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>

            {animeState === 'tired' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-900/80 text-yellow-300 text-xs px-2 py-1 rounded font-mono"
              >
                主人，我要休息了
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 text-center text-xs font-mono text-gray-500">
        HP: {hp}/{maxHp}
      </div>
    </div>
  );
}

export default AvatarModes;
