import { useEffect, useRef, useState, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: { r: number; g: number; b: number; a: number };
  targetColor: { r: number; g: number; b: number; a: number };
  life: number;
  size: number;
}

interface GenesisParticleEngineProps {
  isAuthenticated: boolean;
  onAnimationComplete?: () => void;
  onHiddenPortalActivate?: () => void;
  particleCount?: number;
}

const COLORS = {
  INDIGO: { r: 63, g: 81, b: 181, a: 1 },
  CYAN: { r: 0, g: 188, b: 212, a: 1 },
  WARNING_RED: { r: 244, g: 67, b: 54, a: 1 },
  GOLD: { r: 255, g: 193, b: 7, a: 1 },
  DEEP_PURPLE: { r: 103, g: 58, b: 183, a: 1 },
};

export function GenesisParticleEngine({
  isAuthenticated,
  onAnimationComplete,
  onHiddenPortalActivate,
  particleCount = 2000,
}: GenesisParticleEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef<'scatter' | 'converge' | 'pulse' | 'complete'>('scatter');
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const [hiddenClickCount, setHiddenClickCount] = useState(0);
  const hiddenClickTimer = useRef<NodeJS.Timeout | null>(null);

  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.max(width, height);

      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        color: { ...COLORS.DEEP_PURPLE, a: Math.random() * 0.5 + 0.3 },
        targetColor: { ...COLORS.INDIGO },
        life: 1,
        size: Math.random() * 2 + 1,
      });
    }

    particlesRef.current = particles;
  }, [particleCount]);

  const lerpColor = (
    current: { r: number; g: number; b: number; a: number },
    target: { r: number; g: number; b: number; a: number },
    t: number
  ) => {
    return {
      r: current.r + (target.r - current.r) * t,
      g: current.g + (target.g - current.g) * t,
      b: current.b + (target.b - current.b) * t,
      a: current.a + (target.a - current.a) * t,
    };
  };

  const updateParticles = useCallback((width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const particles = particlesRef.current;
    const phase = phaseRef.current;

    const attractionForce = phase === 'converge' ? 0.02 : 0.005;
    const targetColor = isAuthenticated ? COLORS.CYAN : COLORS.INDIGO;
    const colorLerpSpeed = isAuthenticated ? 0.1 : 0.05;

    for (const p of particles) {
      if (phase === 'scatter') {
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
      } else if (phase === 'converge' || phase === 'pulse') {
        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          p.vx += (dx / dist) * attractionForce * (1 + progressRef.current);
          p.vy += (dy / dist) * attractionForce * (1 + progressRef.current);
        }

        if (phase === 'pulse' && dist < 50) {
          const pulseAngle = Math.atan2(dy, dx);
          const pulseForce = Math.sin(Date.now() * 0.01) * 0.5;
          p.vx += Math.cos(pulseAngle) * pulseForce;
          p.vy += Math.sin(pulseAngle) * pulseForce;
        }
      }

      p.vx *= 0.98;
      p.vy *= 0.98;

      p.x += p.vx;
      p.y += p.vy;

      p.targetColor = targetColor;
      p.color = lerpColor(p.color, p.targetColor, colorLerpSpeed);

      if (isAuthenticated && phase === 'pulse') {
        p.color.a = 0.5 + Math.sin(Date.now() * 0.005 + p.x * 0.01) * 0.3;
      }
    }
  }, [isAuthenticated]);

  const renderParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    const particles = particlesRef.current;

    for (const p of particles) {
      const { r, g, b, a } = p.color;
      ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (phaseRef.current === 'pulse' || phaseRef.current === 'complete') {
      const canvas = ctx.canvas;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100);

      if (isAuthenticated) {
        gradient.addColorStop(0, 'rgba(0, 188, 212, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 188, 212, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 188, 212, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(63, 81, 181, 0.6)');
        gradient.addColorStop(0.5, 'rgba(103, 58, 183, 0.3)');
        gradient.addColorStop(1, 'rgba(103, 58, 183, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [isAuthenticated]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(10, 15, 30, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    progressRef.current += 0.002;

    if (progressRef.current < 0.3) {
      phaseRef.current = 'scatter';
    } else if (progressRef.current < 0.8) {
      phaseRef.current = 'converge';
    } else if (progressRef.current < 1.2) {
      phaseRef.current = 'pulse';
    } else {
      phaseRef.current = 'complete';
      if (onAnimationComplete && !completedRef.current) {
        completedRef.current = true;
        onAnimationComplete();
      }
    }

    updateParticles(canvas.width, canvas.height);
    renderParticles(ctx);

    animationRef.current = requestAnimationFrame(animate);
  }, [updateParticles, renderParticles, onAnimationComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      if (particlesRef.current.length === 0) {
        initParticles(canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [animate, initParticles]);

  const handleHiddenPortalClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 80 && y < 80) {
      setHiddenClickCount(prev => {
        const newCount = prev + 1;

        if (hiddenClickTimer.current) {
          clearTimeout(hiddenClickTimer.current);
        }

        hiddenClickTimer.current = setTimeout(() => {
          setHiddenClickCount(0);
        }, 2000);

        if (newCount >= 5 && onHiddenPortalActivate) {
          onHiddenPortalActivate();
          return 0;
        }

        return newCount;
      });
    }
  }, [onHiddenPortalActivate]);

  return (
    <div className="relative w-full h-full" data-testid="genesis-particle-engine">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 bg-[#0a0f1e]"
        onClick={handleHiddenPortalClick}
        data-testid="genesis-canvas"
      />

      {hiddenClickCount > 0 && hiddenClickCount < 5 && (
        <div
          className="absolute top-2 left-2 w-8 h-8 flex items-center justify-center"
          data-testid="hidden-portal-indicator"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse opacity-50" />
        </div>
      )}

      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center"
        data-testid="genesis-status"
      >
        <div className={`text-sm font-mono transition-colors duration-500 ${
          isAuthenticated ? 'text-cyan-400' : 'text-indigo-400'
        }`}>
          {phaseRef.current === 'scatter' && '[粒子散布中...]'}
          {phaseRef.current === 'converge' && '[生命种子汇聚...]'}
          {phaseRef.current === 'pulse' && '[意识核心激活...]'}
          {phaseRef.current === 'complete' && (isAuthenticated ? '[创世神已降临]' : '[小星待命中]')}
        </div>

        <div className="mt-2 w-48 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div
            className={`h-full transition-all duration-300 ${
              isAuthenticated ? 'bg-cyan-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.min(progressRef.current * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default GenesisParticleEngine;
