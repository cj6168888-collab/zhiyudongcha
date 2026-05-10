import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AvatarConfig } from '../../lib/birth-state-store';

interface SceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

export function InfantCradleScene({ onComplete }: SceneProps) {
  const [breathPhase, setBreathPhase] = useState(0);
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setBreathPhase((prev) => (prev + 1) % 2);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContinue(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center" data-testid="scene-infant-cradle">
      <div className="absolute inset-0 bg-gradient-radial from-pink-950/10 via-transparent to-transparent" />
      
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(251, 207, 232, 0.05) 0%, transparent 50%)',
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
        }}
      />

      <div className="relative z-10 text-center">
        <motion.h2
          className="text-2xl md:text-3xl text-pink-300 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          生命诞生
        </motion.h2>

        <motion.div
          className="relative w-64 h-64 md:w-80 md:h-80 mx-auto"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(251, 113, 133, 0.2) 0%, transparent 70%)',
              filter: 'blur(30px)',
            }}
            animate={{
              scale: breathPhase === 0 ? 1 : 1.1,
              opacity: breathPhase === 0 ? 0.5 : 0.7,
            }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
            }}
          />

          <motion.div
            className="absolute inset-8 rounded-full bg-gradient-to-b from-pink-200/10 to-pink-400/5 border border-pink-300/20"
            style={{
              boxShadow: 'inset 0 0 60px rgba(251, 113, 133, 0.1), 0 0 40px rgba(251, 113, 133, 0.1)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="relative"
                animate={{
                  y: breathPhase === 0 ? 0 : -3,
                }}
                transition={{
                  duration: 2,
                  ease: 'easeInOut',
                }}
              >
                <motion.div
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-b from-pink-100/40 to-pink-200/20"
                  style={{
                    boxShadow: 'inset 0 -10px 20px rgba(0,0,0,0.1)',
                  }}
                />

                <motion.div
                  className="absolute top-1/4 left-1/4 w-2 h-1 rounded-full bg-gray-600/50"
                  animate={{
                    scaleY: [1, 0.2, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                />
                <motion.div
                  className="absolute top-1/4 right-1/4 w-2 h-1 rounded-full bg-gray-600/50"
                  animate={{
                    scaleY: [1, 0.2, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-2 h-1 rounded-full bg-pink-400/50" />

                <motion.div
                  className="absolute top-[60%] left-1/2 -translate-x-1/2 w-4 h-2 rounded-full border-b-2 border-pink-400/30"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                />
              </motion.div>
            </div>
          </motion.div>

          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-pink-300/30"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 2) * 40}%`,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3,
                delay: i * 0.5,
                repeat: Infinity,
              }}
            />
          ))}
        </motion.div>

        <motion.div
          className="mt-8 flex items-center justify-center gap-2"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          <span className="text-pink-400/70 text-sm">♡</span>
          <span className="text-gray-500 text-sm font-mono">轻柔呼吸中...</span>
          <span className="text-pink-400/70 text-sm">♡</span>
        </motion.div>

        <motion.p
          className="mt-4 text-gray-600 text-xs font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          新生命正在甜睡... 等待被唤醒
        </motion.p>

        {showContinue && (
          <motion.button
            onClick={onComplete}
            className="mt-8 px-8 py-3 bg-gradient-to-r from-pink-500/80 to-rose-500/80 text-white rounded-full font-medium hover:from-pink-400 hover:to-rose-400 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-continue-naming"
          >
            为她命名 →
          </motion.button>
        )}
      </div>
    </div>
  );
}
