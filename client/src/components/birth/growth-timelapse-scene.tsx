import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarConfig } from '../../lib/birth-state-store';

interface SceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

type GrowthStage = 'infant' | 'toddler' | 'child' | 'teen' | 'complete';

const STAGE_INFO: Record<GrowthStage, { age: string; size: number; desc: string }> = {
  infant: { age: '0岁', size: 40, desc: '婴儿期' },
  toddler: { age: '3岁', size: 60, desc: '幼儿期' },
  child: { age: '8岁', size: 80, desc: '童年期' },
  teen: { age: '16岁', size: 100, desc: '少年期' },
  complete: { age: '成熟', size: 120, desc: '完成' },
};

export function GrowthTimelapseScene({ onComplete, avatarConfig }: SceneProps) {
  const [stage, setStage] = useState<GrowthStage>('infant');
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    const stages: GrowthStage[] = ['infant', 'toddler', 'child', 'teen', 'complete'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex++;
      if (currentIndex < stages.length) {
        setShowSparkles(true);
        setTimeout(() => setShowSparkles(false), 500);
        setStage(stages[currentIndex]);
      }
      
      if (currentIndex >= stages.length - 1) {
        clearInterval(interval);
        setTimeout(onComplete, 1500);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [onComplete]);

  const stageInfo = STAGE_INFO[stage];
  const isFemale = avatarConfig.gender === 'FEMALE';
  const emoji = stage === 'complete' 
    ? (isFemale ? '👩' : avatarConfig.gender === 'MALE' ? '👨' : '🧑')
    : stage === 'teen'
    ? (isFemale ? '👧' : avatarConfig.gender === 'MALE' ? '👦' : '🧒')
    : stage === 'child'
    ? '🧒'
    : stage === 'toddler'
    ? '👶'
    : '👶';

  return (
    <div className="absolute inset-0 flex items-center justify-center" data-testid="scene-growth-timelapse">
      <div className="absolute inset-0 bg-gradient-radial from-green-950/10 via-transparent to-transparent" />

      <div className="relative z-10 text-center">
        <motion.h2
          className="text-2xl md:text-3xl font-bold text-green-300 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          时光流转
        </motion.h2>
        <motion.p
          className="text-gray-500 text-sm font-mono mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ACCELERATED GROWTH SEQUENCE
        </motion.p>

        <motion.div
          className="relative w-64 h-64 mx-auto flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              className="relative flex flex-col items-center"
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="relative"
                style={{ fontSize: `${stageInfo.size}px` }}
              >
                {emoji}
                
                {showSparkles && (
                  <>
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                        initial={{ 
                          x: 0, 
                          y: 0,
                          scale: 0,
                        }}
                        animate={{ 
                          x: Math.cos(i * Math.PI / 4) * 60,
                          y: Math.sin(i * Math.PI / 4) * 60,
                          scale: [0, 1, 0],
                        }}
                        transition={{ duration: 0.5 }}
                        style={{
                          top: '50%',
                          left: '50%',
                          boxShadow: '0 0 10px rgba(250, 204, 21, 0.8)',
                        }}
                      />
                    ))}
                  </>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-green-400 mb-1">{stageInfo.age}</p>
              <p className="text-gray-500 text-sm">{stageInfo.desc}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="mt-8 flex justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {Object.keys(STAGE_INFO).map((s) => (
            <motion.div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === stage
                  ? 'w-8 bg-green-400'
                  : Object.keys(STAGE_INFO).indexOf(s) < Object.keys(STAGE_INFO).indexOf(stage)
                  ? 'w-4 bg-green-600'
                  : 'w-4 bg-gray-700'
              }`}
            />
          ))}
        </motion.div>

        <motion.p
          className="mt-6 text-gray-600 text-xs font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {avatarConfig.name} · {avatarConfig.personality === 'CHEERFUL' ? '开朗活泼' : avatarConfig.personality === 'GENTLE' ? '温柔体贴' : avatarConfig.personality === 'MATURE' ? '成熟稳重' : '俏皮可爱'}
        </motion.p>
      </div>
    </div>
  );
}
