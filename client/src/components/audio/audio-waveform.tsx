import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface AudioWaveformProps {
  isActive: boolean;
  volumeLevel: number;
  barCount?: number;
  height?: number;
  color?: string;
  gradientColors?: [string, string];
}

export function AudioWaveform({
  isActive,
  volumeLevel,
  barCount = 32,
  height = 60,
  color = "#f59e0b",
  gradientColors = ["#22c55e", "#f59e0b"]
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    if (barsRef.current.length === 0) {
      barsRef.current = Array(barCount).fill(0).map(() => Math.random() * 0.1);
    }
  }, [barCount]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const canvasHeight = canvas.height;
    const barWidth = width / barCount - 2;
    const centerY = canvasHeight / 2;

    ctx.clearRect(0, 0, width, canvasHeight);

    for (let i = 0; i < barCount; i++) {
      const targetHeight = isActive
        ? (Math.random() * 0.5 + 0.3) * volumeLevel * canvasHeight
        : 4;

      barsRef.current[i] += (targetHeight - barsRef.current[i]) * 0.15;
      const barHeight = Math.max(4, barsRef.current[i]);

      const gradient = ctx.createLinearGradient(
        0,
        centerY - barHeight / 2,
        0,
        centerY + barHeight / 2
      );
      gradient.addColorStop(0, gradientColors[0]);
      gradient.addColorStop(1, gradientColors[1]);

      ctx.fillStyle = isActive ? gradient : "#475569";
      ctx.beginPath();
      
      const x = i * (barWidth + 2) + 1;
      const y = centerY - barHeight / 2;
      const w = barWidth;
      const h = barHeight;
      const r = 2;
      
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [isActive, volumeLevel, barCount, gradientColors]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-lg bg-slate-900/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      
      {isActive && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          animate={{
            x: ["0%", "100%"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}
    </motion.div>
  );
}

export function CircularWaveform({
  isActive,
  volumeLevel,
  size = 120,
}: {
  isActive: boolean;
  volumeLevel: number;
  size?: number;
}) {
  const rings = 4;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {Array(rings).fill(0).map((_, i) => {
        const baseRadius = (size / 2) * ((i + 1) / rings);
        const animatedRadius = isActive 
          ? baseRadius * (1 + volumeLevel * 0.2 * Math.sin(Date.now() / 200 + i))
          : baseRadius;
        
        return (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              width: animatedRadius * 2,
              height: animatedRadius * 2,
              left: size / 2 - animatedRadius,
              top: size / 2 - animatedRadius,
              borderColor: isActive 
                ? `rgba(245, 158, 11, ${0.8 - i * 0.15})`
                : "rgba(71, 85, 105, 0.5)",
            }}
            animate={{
              scale: isActive ? [1, 1.05, 1] : 1,
              opacity: isActive ? [0.8 - i * 0.15, 0.6 - i * 0.1, 0.8 - i * 0.15] : 0.3,
            }}
            transition={{
              duration: 0.8 + i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}
      
      <motion.div
        className="absolute rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center"
        style={{
          width: size / 3,
          height: size / 3,
          left: size / 3,
          top: size / 3,
        }}
        animate={{
          scale: isActive ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-white' : 'bg-slate-400'}`} />
      </motion.div>
    </div>
  );
}
