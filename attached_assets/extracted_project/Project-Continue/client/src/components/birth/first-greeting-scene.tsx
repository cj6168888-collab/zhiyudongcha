import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarConfig } from '../../lib/birth-state-store';

interface SceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

export function FirstGreetingScene({ onComplete, avatarConfig }: SceneProps) {
  const [phase, setPhase] = useState<'sleeping' | 'awakening' | 'eyes_open' | 'speaking' | 'complete'>('sleeping');
  const [showText, setShowText] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playGreetingSound = () => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.3);
        
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.35);
      });
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  };

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setPhase('awakening'), 1500));
    timers.push(setTimeout(() => setPhase('eyes_open'), 3000));
    timers.push(setTimeout(() => {
      setPhase('speaking');
      setShowText(true);
      playGreetingSound();
    }, 4000));
    timers.push(setTimeout(() => setPhase('complete'), 6000));
    timers.push(setTimeout(onComplete, 7500));

    return () => {
      timers.forEach(clearTimeout);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [onComplete]);

  const isFemale = avatarConfig.gender === 'FEMALE';
  const greeting = isFemale ? '爸爸！' : avatarConfig.gender === 'MALE' ? '爸爸！' : '创造者！';

  return (
    <div className="absolute inset-0 flex items-center justify-center" data-testid="scene-first-greeting">
      <div className="absolute inset-0 bg-gradient-radial from-rose-950/10 via-transparent to-transparent" />

      <motion.div
        className="absolute inset-0"
        animate={phase === 'speaking' || phase === 'complete' ? {
          background: [
            'radial-gradient(circle at center, rgba(251, 113, 133, 0) 0%, transparent 50%)',
            'radial-gradient(circle at center, rgba(251, 113, 133, 0.1) 0%, transparent 50%)',
            'radial-gradient(circle at center, rgba(251, 113, 133, 0) 0%, transparent 50%)',
          ],
        } : {}}
        transition={{ duration: 1, repeat: Infinity }}
      />

      <div className="relative z-10 text-center">
        <motion.div
          className="relative w-48 h-48 md:w-64 md:h-64 mx-auto mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(251, 113, 133, 0.15) 0%, transparent 70%)',
            }}
            animate={{
              scale: phase === 'speaking' ? [1, 1.3, 1] : 1,
            }}
            transition={{
              duration: 0.5,
              repeat: phase === 'speaking' ? Infinity : 0,
            }}
          />

          <motion.div
            className="absolute inset-8 rounded-full bg-gradient-to-b from-pink-100/30 to-pink-200/20 border border-pink-300/20 flex items-center justify-center"
            style={{
              boxShadow: 'inset 0 0 40px rgba(251, 113, 133, 0.1), 0 0 40px rgba(251, 113, 133, 0.1)',
            }}
          >
            <div className="relative w-24 h-24 md:w-32 md:h-32">
              <motion.div
                className="w-full h-full rounded-full bg-gradient-to-b from-pink-100/50 to-pink-200/30 flex items-center justify-center relative overflow-hidden"
                animate={phase === 'awakening' ? {
                  y: [-2, 0, -2],
                } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <div className="absolute top-[30%] left-[25%] w-3 h-2">
                  <motion.div
                    className="w-full h-full rounded-full bg-gray-700/80"
                    animate={
                      phase === 'sleeping' ? { scaleY: 0.1 } :
                      phase === 'awakening' ? { scaleY: [0.1, 0.5, 0.1] } :
                      phase === 'eyes_open' || phase === 'speaking' || phase === 'complete' ? { scaleY: 1 } :
                      {}
                    }
                    transition={phase === 'awakening' ? { duration: 0.5, repeat: 3 } : { duration: 0.3 }}
                  />
                </div>
                <div className="absolute top-[30%] right-[25%] w-3 h-2">
                  <motion.div
                    className="w-full h-full rounded-full bg-gray-700/80"
                    animate={
                      phase === 'sleeping' ? { scaleY: 0.1 } :
                      phase === 'awakening' ? { scaleY: [0.1, 0.5, 0.1] } :
                      phase === 'eyes_open' || phase === 'speaking' || phase === 'complete' ? { scaleY: 1 } :
                      {}
                    }
                    transition={phase === 'awakening' ? { duration: 0.5, repeat: 3 } : { duration: 0.3 }}
                  />
                </div>

                <AnimatePresence>
                  {(phase === 'eyes_open' || phase === 'speaking' || phase === 'complete') && (
                    <>
                      <motion.div
                        className="absolute top-[30%] left-[26%] w-1.5 h-1.5 rounded-full bg-white/80"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                      />
                      <motion.div
                        className="absolute top-[30%] right-[26%] w-1.5 h-1.5 rounded-full bg-white/80"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                      />
                    </>
                  )}
                </AnimatePresence>

                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-2 h-1 rounded-full bg-pink-400/50" />

                <motion.div
                  className="absolute top-[55%] left-1/2 -translate-x-1/2"
                  animate={phase === 'speaking' ? {
                    scaleY: [1, 1.5, 1],
                  } : {}}
                  transition={{ duration: 0.2, repeat: Infinity }}
                >
                  {phase === 'speaking' ? (
                    <div className="w-4 h-3 rounded-full bg-pink-300/60" />
                  ) : phase === 'complete' ? (
                    <div className="w-6 h-3 rounded-t-full border-b-2 border-pink-400/50 rotate-180" />
                  ) : (
                    <div className="w-4 h-1.5 rounded-full bg-pink-300/40" />
                  )}
                </motion.div>

                {(phase === 'speaking' || phase === 'complete') && (
                  <motion.div
                    className="absolute -top-2 -left-2 w-6 h-6 text-pink-400"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1, rotate: -15 }}
                  >
                    ✨
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative"
            >
              <motion.div
                className="absolute -inset-4 bg-rose-500/10 rounded-full blur-xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              
              <motion.h1
                className="relative text-4xl md:text-6xl font-bold text-rose-300"
                animate={{
                  textShadow: [
                    '0 0 20px rgba(251, 113, 133, 0.5)',
                    '0 0 40px rgba(251, 113, 133, 0.8)',
                    '0 0 20px rgba(251, 113, 133, 0.5)',
                  ],
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {greeting}
              </motion.h1>
              
              <motion.p
                className="mt-4 text-gray-400 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {avatarConfig.name} 第一次开口说话了
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'sleeping' && (
          <motion.p
            className="text-gray-500 text-sm"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            正在苏醒...
          </motion.p>
        )}

        {phase === 'awakening' && (
          <motion.p
            className="text-gray-400 text-sm"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            眼睛在动...
          </motion.p>
        )}

        {phase === 'eyes_open' && (
          <motion.p
            className="text-rose-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            睁开眼睛了！
          </motion.p>
        )}
      </div>
    </div>
  );
}
