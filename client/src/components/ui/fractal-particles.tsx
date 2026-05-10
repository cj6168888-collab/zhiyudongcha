import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface FractalParticlesProps {
  active: boolean;
  phase: 'gathering' | 'colliding' | 'stable' | 'idle';
  className?: string;
}

export function FractalParticles({ active, phase, className = '' }: FractalParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
    }> = [];

    const colors = ['#0080ff', '#00d4ff', '#8b5cf6', '#fbbf24'];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 150 + Math.random() * 100;
      particles.push({
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        size: 1 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.3 + Math.random() * 0.7,
      });
    }

    let animationId: number;
    let frame = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      particles.forEach((p, i) => {
        if (phase === 'gathering') {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            p.vx += dx * 0.002;
            p.vy += dy * 0.002;
          }
        } else if (phase === 'colliding') {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          p.vx += dx * 0.01;
          p.vy += dy * 0.01;
          if (dist < 20) {
            p.alpha = Math.min(1, p.alpha + 0.1);
            p.size = Math.min(6, p.size + 0.2);
          }
        } else if (phase === 'stable') {
          const angle = (frame * 0.02) + (i * 0.1);
          const radius = 30 + Math.sin(frame * 0.01 + i) * 10;
          p.x = centerX + Math.cos(angle) * radius;
          p.y = centerY + Math.sin(angle) * radius;
        }

        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (phase === 'stable' && i > 0) {
          const prev = particles[i - 1];
          const dist = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
          if (dist < 50) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(prev.x, prev.y);
            ctx.strokeStyle = `rgba(0, 128, 255, ${0.3 * (1 - dist / 50)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      if (phase === 'stable') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 25);
        gradient.addColorStop(0, 'rgba(0, 180, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 128, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [active, phase]);

  if (!active) return null;

  return (
    <motion.canvas
      ref={canvasRef}
      width={400}
      height={400}
      className={`absolute inset-0 m-auto ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  );
}

export function CodeStream({ active }: { active: boolean }) {
  if (!active) return null;

  const codeLines = [
    'v6.0.1-Bio-CN initializing...',
    'Z1::GodProtocol.authenticate()',
    'Z2::BedrockMatrix.loadRelations()',
    'Z3::SpiritCore.syncNodes()',
    'DNA_SIGNATURE: verified',
    'HP_BALANCE: loading...',
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
      {codeLines.map((line, i) => (
        <motion.div
          key={i}
          className="absolute left-4 font-mono text-xs text-primary/60 whitespace-nowrap"
          initial={{ opacity: 0, y: 100 + i * 20 }}
          animate={{ 
            opacity: [0, 0.6, 0.6, 0],
            y: [100 + i * 20, 50, -50, -100]
          }}
          transition={{
            duration: 4,
            delay: i * 0.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        >
          {line}
        </motion.div>
      ))}
    </div>
  );
}
