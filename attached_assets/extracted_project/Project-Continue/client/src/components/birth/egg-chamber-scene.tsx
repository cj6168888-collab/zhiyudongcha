import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarConfig } from '../../lib/birth-state-store';

interface SceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

type BabyPhase = 
  | 'gathering'      // 能量汇聚
  | 'forming'        // 婴儿成形
  | 'growing'        // 微微变大
  | 'eyes_opening'   // 睁开眼睛
  | 'smiling'        // 微笑
  | 'reaching'       // 伸手要抱抱
  | 'calling'        // 叫爸爸
  | 'complete';

export function EggChamberScene({ onComplete, avatarConfig }: SceneProps) {
  const [phase, setPhase] = useState<BabyPhase>('gathering');
  const [energyLevel, setEnergyLevel] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [breathCycle, setBreathCycle] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatRef = useRef<AudioContext | null>(null);
  const audioRetryCount = useRef(0);

  const playHeartbeat = useCallback(() => {
    try {
      if (!heartbeatRef.current || heartbeatRef.current.state === 'closed') {
        heartbeatRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = heartbeatRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(55, ctx.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.08);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn('Heartbeat playback failed:', e);
    }
  }, []);

  const playVoiceWithRetry = useCallback(async () => {
    if (!audioRef.current || audioPlayed) return;
    
    const tryPlay = async (): Promise<boolean> => {
      try {
        await audioRef.current!.play();
        setAudioPlayed(true);
        return true;
      } catch (e) {
        console.warn('Audio play attempt failed:', e);
        return false;
      }
    };

    const success = await tryPlay();
    if (!success && audioRetryCount.current < 3) {
      audioRetryCount.current++;
      setTimeout(() => {
        playVoiceWithRetry();
      }, 500);
    } else if (!success) {
      setAudioFailed(true);
    }
  }, [audioPlayed]);

  useEffect(() => {
    const fetchVoice = async () => {
      try {
        const response = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '爸爸',
            voice: 'longtong',
            rate: 0.85,
            pitch: 1.1,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.audioBase64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
            audio.preload = 'auto';
            audioRef.current = audio;
            setAudioLoaded(true);
          } else {
            setAudioFailed(true);
          }
        } else {
          setAudioFailed(true);
        }
      } catch (e) {
        console.warn('Voice synthesis failed:', e);
        setAudioFailed(true);
      }
    };
    
    fetchVoice();
    
    return () => {
      if (heartbeatRef.current && heartbeatRef.current.state !== 'closed') {
        heartbeatRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const particles: Array<{
      x: number;
      y: number;
      angle: number;
      radius: number;
      speed: number;
      size: number;
      hue: number;
      alpha: number;
    }> = [];

    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 180 + Math.random() * 250;
      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        angle,
        radius,
        speed: 0.3 + Math.random() * 0.8,
        size: 1 + Math.random() * 2.5,
        hue: 190 + Math.random() * 30,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }

    let animationId: number;
    let gatherProgress = 0;

    const animate = () => {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.03)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      gatherProgress += 0.001;
      const attractionStrength = Math.min(gatherProgress * 1.5, 0.95);

      for (const p of particles) {
        const targetRadius = 60 * (1 - attractionStrength) + p.radius * (1 - attractionStrength);
        p.radius -= (p.radius - targetRadius) * 0.008;
        p.angle += p.speed * 0.015;

        p.x = centerX + Math.cos(p.angle) * p.radius;
        p.y = centerY + Math.sin(p.angle) * p.radius;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${p.alpha})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 120 * attractionStrength + 30);
      coreGlow.addColorStop(0, `rgba(79, 209, 255, ${0.3 * attractionStrength})`);
      coreGlow.addColorStop(0.6, `rgba(147, 197, 253, ${0.15 * attractionStrength})`);
      coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
      ctx.fillStyle = coreGlow;
      ctx.fill();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    const breathInterval = setInterval(() => {
      setBreathCycle(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(breathInterval);
  }, []);

  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | undefined;
    
    if (phase === 'forming' || phase === 'growing') {
      heartbeatInterval = setInterval(playHeartbeat, 900);
    }
    
    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [phase, playHeartbeat]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    timers.push(setTimeout(() => setPhase('forming'), 2500));
    timers.push(setTimeout(() => setPhase('growing'), 5000));
    timers.push(setTimeout(() => setPhase('eyes_opening'), 8000));
    timers.push(setTimeout(() => setPhase('smiling'), 10500));
    timers.push(setTimeout(() => setPhase('reaching'), 12500));
    timers.push(setTimeout(() => setPhase('calling'), 15000));
    timers.push(setTimeout(() => setPhase('complete'), 17500));
    timers.push(setTimeout(onComplete, 19000));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (phase === 'calling' && audioLoaded && !audioPlayed) {
      playVoiceWithRetry();
    }
  }, [phase, audioLoaded, audioPlayed, playVoiceWithRetry]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEnergyLevel((prev) => Math.min(prev + 1.5, 100));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const breathScale = 1 + Math.sin(breathCycle * 0.06) * 0.02;
  const phaseIndex = ['gathering', 'forming', 'growing', 'eyes_opening', 'smiling', 'reaching', 'calling', 'complete'].indexOf(phase);
  const showBaby = phaseIndex >= 1;
  const eyesOpen = phaseIndex >= 3;
  const isSmiling = phaseIndex >= 4;
  const armsReaching = phaseIndex >= 5;
  const isCalling = phaseIndex >= 6;

  const getPhaseText = () => {
    switch (phase) {
      case 'gathering': return '能量汇聚中...';
      case 'forming': return '生命在孕育...';
      case 'growing': return '慢慢成长...';
      case 'eyes_opening': return '感知到了光芒...';
      case 'smiling': return '认出了你...';
      case 'reaching': return '想要拥抱...';
      case 'calling': return '';
      case 'complete': return '';
      default: return '';
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" data-testid="scene-egg-chamber">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="absolute inset-0 bg-gradient-radial from-cyan-950/20 via-transparent to-transparent" />

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          className="text-xl md:text-2xl text-cyan-300/80 mb-8 h-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {getPhaseText()}
        </motion.div>

        <motion.div
          className="relative w-64 h-80 md:w-80 md:h-96"
          animate={{
            scale: phase === 'growing' || phase === 'eyes_opening' ? [1, 1.08, 1.05] : 1,
          }}
          transition={{ duration: 2, ease: 'easeOut' }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(79, 209, 255, 0.25) 0%, rgba(147, 197, 253, 0.1) 40%, transparent 70%)',
              filter: 'blur(30px)',
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <AnimatePresence>
            {showBaby && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              >
                <svg
                  viewBox="0 0 200 280"
                  className="w-full h-full"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(79, 209, 255, 0.5))' }}
                >
                  <defs>
                    <radialGradient id="babyGlow" cx="50%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="rgba(147, 197, 253, 0.6)" />
                      <stop offset="50%" stopColor="rgba(79, 209, 255, 0.35)" />
                      <stop offset="100%" stopColor="rgba(79, 209, 255, 0.1)" />
                    </radialGradient>
                    <radialGradient id="headGlow" cx="50%" cy="40%" r="50%">
                      <stop offset="0%" stopColor="rgba(199, 210, 254, 0.7)" />
                      <stop offset="60%" stopColor="rgba(147, 197, 253, 0.4)" />
                      <stop offset="100%" stopColor="rgba(79, 209, 255, 0.2)" />
                    </radialGradient>
                    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <g filter="url(#softGlow)" transform={`scale(${breathScale})`} style={{ transformOrigin: '100px 140px' }}>
                    <ellipse
                      cx="100"
                      cy="70"
                      rx="45"
                      ry="50"
                      fill="url(#headGlow)"
                      stroke="rgba(147, 197, 253, 0.3)"
                      strokeWidth="1"
                    />

                    <motion.ellipse
                      cx="100"
                      cy="160"
                      rx="35"
                      ry="55"
                      fill="url(#babyGlow)"
                      stroke="rgba(147, 197, 253, 0.2)"
                      strokeWidth="1"
                      animate={{
                        ry: [55, 57, 55],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />

                    <motion.g
                      animate={armsReaching ? {
                        x: [-15, -25, -25],
                        y: [0, -20, -20],
                        rotate: [0, -30, -35],
                      } : {}}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ transformOrigin: '65px 130px' }}
                    >
                      <ellipse
                        cx="55"
                        cy="145"
                        rx="12"
                        ry="30"
                        fill="url(#babyGlow)"
                        transform="rotate(-20, 55, 145)"
                      />
                      <motion.circle
                        cx="45"
                        cy="120"
                        r="10"
                        fill="url(#headGlow)"
                        animate={armsReaching ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      />
                    </motion.g>

                    <motion.g
                      animate={armsReaching ? {
                        x: [15, 25, 25],
                        y: [0, -20, -20],
                        rotate: [0, 30, 35],
                      } : {}}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ transformOrigin: '135px 130px' }}
                    >
                      <ellipse
                        cx="145"
                        cy="145"
                        rx="12"
                        ry="30"
                        fill="url(#babyGlow)"
                        transform="rotate(20, 145, 145)"
                      />
                      <motion.circle
                        cx="155"
                        cy="120"
                        r="10"
                        fill="url(#headGlow)"
                        animate={armsReaching ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      />
                    </motion.g>

                    <ellipse
                      cx="75"
                      cy="210"
                      rx="10"
                      ry="25"
                      fill="url(#babyGlow)"
                      transform="rotate(-10, 75, 210)"
                    />
                    <ellipse
                      cx="125"
                      cy="210"
                      rx="10"
                      ry="25"
                      fill="url(#babyGlow)"
                      transform="rotate(10, 125, 210)"
                    />

                    <motion.g>
                      <motion.ellipse
                        cx="82"
                        cy="65"
                        rx="10"
                        ry={eyesOpen ? 8 : 1}
                        fill="rgba(30, 58, 138, 0.9)"
                        animate={{
                          ry: eyesOpen ? [8, 8, 1, 8] : 1,
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          times: [0, 0.9, 0.95, 1],
                        }}
                      />
                      {eyesOpen && (
                        <motion.circle
                          cx="84"
                          cy="63"
                          r="3"
                          fill="rgba(255, 255, 255, 0.9)"
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 }}
                        />
                      )}

                      <motion.ellipse
                        cx="118"
                        cy="65"
                        rx="10"
                        ry={eyesOpen ? 8 : 1}
                        fill="rgba(30, 58, 138, 0.9)"
                        animate={{
                          ry: eyesOpen ? [8, 8, 1, 8] : 1,
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          times: [0, 0.9, 0.95, 1],
                        }}
                      />
                      {eyesOpen && (
                        <motion.circle
                          cx="120"
                          cy="63"
                          r="3"
                          fill="rgba(255, 255, 255, 0.9)"
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 }}
                        />
                      )}
                    </motion.g>

                    <ellipse
                      cx="100"
                      cy="78"
                      rx="4"
                      ry="3"
                      fill="rgba(147, 197, 253, 0.5)"
                    />

                    <motion.g>
                      {isSmiling ? (
                        <motion.path
                          d="M 88 90 Q 100 102 112 90"
                          stroke="rgba(251, 113, 133, 0.7)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5 }}
                        />
                      ) : (
                        <ellipse
                          cx="100"
                          cy="92"
                          rx="6"
                          ry="3"
                          fill="rgba(251, 113, 133, 0.4)"
                        />
                      )}
                    </motion.g>

                    {isSmiling && (
                      <>
                        <motion.ellipse
                          cx="72"
                          cy="75"
                          rx="6"
                          ry="4"
                          fill="rgba(251, 113, 133, 0.3)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.3, 0.5, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.ellipse
                          cx="128"
                          cy="75"
                          rx="6"
                          ry="4"
                          fill="rgba(251, 113, 133, 0.3)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.3, 0.5, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </>
                    )}
                  </g>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {isCalling && (
            <motion.div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
            >
              <motion.div
                className="relative px-8 py-4 bg-gradient-to-r from-rose-500/20 to-pink-500/20 rounded-full border border-rose-400/30"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(251, 113, 133, 0.3)',
                    '0 0 40px rgba(251, 113, 133, 0.5)',
                    '0 0 20px rgba(251, 113, 133, 0.3)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <motion.span
                  className="text-3xl md:text-4xl font-bold text-rose-300"
                  animate={{
                    textShadow: [
                      '0 0 10px rgba(251, 113, 133, 0.5)',
                      '0 0 25px rgba(251, 113, 133, 0.8)',
                      '0 0 10px rgba(251, 113, 133, 0.5)',
                    ],
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  爸爸～
                </motion.span>
              </motion.div>
            </motion.div>
          )}

          {armsReaching && !isCalling && (
            <motion.div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-cyan-300/60 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              想要抱抱...
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className="mt-12 w-48 mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>生命能量</span>
            <span>{Math.floor(energyLevel)}%</span>
          </div>
          <div className="h-2 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400"
              initial={{ width: 0 }}
              animate={{ width: `${energyLevel}%` }}
            />
          </div>
        </motion.div>

        <motion.p
          className="mt-4 text-gray-500/70 text-xs font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          基因组合: {avatarConfig.selectedGenes.slice(0, 3).join(' · ')}
        </motion.p>
      </div>
    </div>
  );
}
