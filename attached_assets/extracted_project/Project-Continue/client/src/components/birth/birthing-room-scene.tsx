import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AvatarConfig } from '../../lib/birth-state-store';

interface SceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

export function BirthingRoomScene({ onComplete }: SceneProps) {
  const [doorOpen, setDoorOpen] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const corridorParticles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];
    
    for (let i = 0; i < 100; i++) {
      corridorParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * 0.3 + 0.1,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const p of corridorParticles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.y > canvas.height) p.y = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${p.alpha})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleDoorClick = useCallback(() => {
    if (!doorOpen) {
      setShowGlow(true);
      setTimeout(() => {
        setDoorOpen(true);
        setTimeout(onComplete, 1500);
      }, 800);
    }
  }, [doorOpen, onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center" data-testid="scene-birthing-room">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/10 to-cyan-950/30" />

      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 3,
            delay: p.delay,
            repeat: Infinity,
          }}
        />
      ))}

      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#0a1628] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#0a1628] to-transparent" />

      <div className="absolute left-0 right-0 h-full flex items-center justify-center">
        <div className="relative perspective-1000">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <h1 className="text-3xl md:text-5xl font-bold text-cyan-300 mb-4 tracking-wider">
              生命诞生室
            </h1>
            <p className="text-gray-400 text-sm font-mono">GENESIS CHAMBER - Z6</p>
          </motion.div>

          <motion.div
            className="relative cursor-pointer"
            onClick={handleDoorClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid="button-enter-door"
          >
            {showGlow && (
              <motion.div
                className="absolute inset-0 bg-cyan-400/30 rounded-3xl blur-3xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1.2 }}
                transition={{ duration: 0.5 }}
              />
            )}

            <motion.div
              className="relative w-48 h-72 md:w-64 md:h-96 rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                border: '2px solid rgba(34, 211, 238, 0.3)',
                boxShadow: doorOpen 
                  ? '0 0 100px rgba(34, 211, 238, 0.8), inset 0 0 60px rgba(34, 211, 238, 0.3)'
                  : '0 0 30px rgba(34, 211, 238, 0.3), inset 0 0 20px rgba(34, 211, 238, 0.1)',
              }}
              animate={doorOpen ? { 
                scaleX: [1, 1.5, 2],
                opacity: [1, 1, 0],
              } : {}}
              transition={{ duration: 1.5 }}
            >
              <motion.div
                className="absolute inset-2 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(34, 211, 238, 0.1) 0%, rgba(34, 211, 238, 0.05) 50%, rgba(34, 211, 238, 0.1) 100%)',
                }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-16 h-16 rounded-full border-2 border-cyan-400/50"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(34, 211, 238, 0.3)',
                      '0 0 40px rgba(34, 211, 238, 0.6)',
                      '0 0 20px rgba(34, 211, 238, 0.3)',
                    ],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                      className="text-cyan-400 text-2xl"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    >
                      ✦
                    </motion.span>
                  </div>
                </motion.div>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <motion.p
                  className="text-cyan-400/70 text-xs font-mono whitespace-nowrap"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {doorOpen ? '传送中...' : '触摸开启'}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden md:block">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-24 bg-gradient-to-b from-cyan-400/0 via-cyan-400/50 to-cyan-400/0 mb-4"
            animate={{
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 2,
              delay: i * 0.3,
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-24 bg-gradient-to-b from-cyan-400/0 via-cyan-400/50 to-cyan-400/0 mb-4"
            animate={{
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 2,
              delay: i * 0.3 + 0.5,
              repeat: Infinity,
            }}
          />
        ))}
      </div>
    </div>
  );
}
