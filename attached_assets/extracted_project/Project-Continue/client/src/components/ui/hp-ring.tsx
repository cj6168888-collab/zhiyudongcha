import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HpRingProps {
  current: number;
  max: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

interface HpFloatProps {
  value: number;
  onComplete: () => void;
}

function HpFloat({ value, onComplete }: HpFloatProps) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -30, scale: 0.8 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      className={`absolute -top-2 left-1/2 -translate-x-1/2 font-mono text-sm font-bold ${
        value < 0 ? 'text-red-400' : 'text-green-400'
      }`}
    >
      {value > 0 ? '+' : ''}{value} HP
    </motion.div>
  );
}

export function HpRing({ current, max, size = 48, showValue = true, className = '' }: HpRingProps) {
  const [floats, setFloats] = useState<{ id: number; value: number }[]>([]);
  const [prevCurrent, setPrevCurrent] = useState(current);
  
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const ringColor = percentage > 60 ? 'stroke-primary' : percentage > 30 ? 'stroke-yellow-500' : 'stroke-red-500';
  const glowColor = percentage > 60 ? 'drop-shadow-[0_0_6px_hsl(210,100%,50%)]' : 
                    percentage > 30 ? 'drop-shadow-[0_0_6px_hsl(45,100%,50%)]' : 
                    'drop-shadow-[0_0_6px_hsl(0,70%,50%)]';

  useEffect(() => {
    if (current !== prevCurrent) {
      const diff = current - prevCurrent;
      if (diff !== 0) {
        setFloats(prev => [...prev, { id: Date.now(), value: diff }]);
      }
      setPrevCurrent(current);
    }
  }, [current, prevCurrent]);

  const removeFloat = (id: number) => {
    setFloats(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 40 40" 
        className={`-rotate-90 ${glowColor}`}
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          strokeWidth="2"
          className="stroke-muted/30"
        />
        <motion.circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={ringColor}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-mono font-bold text-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      )}

      <AnimatePresence>
        {floats.map(f => (
          <HpFloat key={f.id} value={f.value} onComplete={() => removeFloat(f.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function HpBar({ current, max, className = '' }: { current: number; max: number; className?: string }) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  const barColor = percentage > 60 ? 'bg-primary' : percentage > 30 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className={`relative h-2 w-full rounded-full bg-muted/30 overflow-hidden ${className}`}>
      <motion.div
        className={`absolute inset-y-0 left-0 ${barColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
