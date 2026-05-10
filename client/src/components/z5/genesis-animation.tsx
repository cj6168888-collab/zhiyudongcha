import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useZ1Store } from '@/lib/z1/god-protocol';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface GenesisAnimationProps {
  onComplete: (validated: boolean) => void;
}

export function GenesisAnimation({ onComplete }: GenesisAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'gathering' | 'validating' | 'complete'>('gathering');
  const [validated, setValidated] = useState(false);
  const { aiServices } = useZ1Store();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const particleCount = 150;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 300;
      particles.push({
        id: i,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        size: 2 + Math.random() * 4,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    let animationFrame: number;
    let startTime = Date.now();
    const gatherDuration = 2000;
    const validateDuration = 1000;

    const hasValidKey = aiServices.some(s => s.isActive && s.apiKey);

    const animate = () => {
      const elapsed = Date.now() - startTime;

      ctx.fillStyle = 'rgba(15, 23, 42, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (elapsed < gatherDuration) {
        const progress = elapsed / gatherDuration;
        const eased = 1 - Math.pow(1 - progress, 3);

        particles.forEach(p => {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          p.x += dx * eased * 0.05;
          p.y += dy * eased * 0.05;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239, 68, 68, ${p.alpha * (1 - progress * 0.5)})`;
          ctx.fill();
        });

        if (progress > 0.5 && phase === 'gathering') {
          setPhase('validating');
        }
      } else if (elapsed < gatherDuration + validateDuration) {
        const validateProgress = (elapsed - gatherDuration) / validateDuration;
        setValidated(hasValidKey);

        particles.forEach(p => {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          p.x += dx * 0.1;
          p.y += dy * 0.1;

          const redComponent = hasValidKey ? 68 * (1 - validateProgress) : 239;
          const greenComponent = hasValidKey ? 68 + 183 * validateProgress : 68;
          const blueComponent = hasValidKey ? 68 + 183 * validateProgress : 68;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + validateProgress * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${redComponent}, ${greenComponent}, ${blueComponent}, ${p.alpha})`;
          ctx.fill();
        });

        const glowRadius = 50 + validateProgress * 100;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);

        if (hasValidKey) {
          gradient.addColorStop(0, 'rgba(34, 211, 238, 0.8)');
          gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.3)');
          gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
          gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.3)');
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

      } else {
        setPhase('complete');
        cancelAnimationFrame(animationFrame);

        setTimeout(() => {
          onComplete(hasValidKey);
        }, 500);
        return;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, [aiServices, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900" data-testid="genesis-animation">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <AnimatePresence>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.h1
            className="text-4xl font-bold mb-4"
            style={{
              color: phase === 'complete'
                ? (validated ? '#22d3ee' : '#ef4444')
                : '#94a3b8'
            }}
            animate={{
              scale: phase === 'validating' ? [1, 1.05, 1] : 1,
              opacity: phase === 'complete' ? 0 : 1
            }}
            transition={{ duration: 0.5, repeat: phase === 'validating' ? Infinity : 0 }}
          >
            小星 · 战术终端
          </motion.h1>

          <motion.p
            className="text-lg text-slate-400"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            {phase === 'gathering' && 'CN-Fractal 粒子汇聚中...'}
            {phase === 'validating' && '验证 API 密钥...'}
            {phase === 'complete' && (validated ? '✓ 身份验证成功' : '⚠ 未配置 API 密钥')}
          </motion.p>

          {phase === 'complete' && !validated && (
            <motion.p
              className="text-sm text-amber-400 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              访客模式启动
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
