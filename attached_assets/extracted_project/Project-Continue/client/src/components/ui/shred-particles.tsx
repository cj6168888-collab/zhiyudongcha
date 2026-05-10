import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

interface ShredParticlesProps {
  active: boolean;
  count?: number;
  className?: string;
}

export function ShredParticles({ active, count = 12, className = '' }: ShredParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: Date.now() + i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 2 + Math.random() * 4,
          delay: Math.random() * 0.3,
        });
      }
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [active, count]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-red-500"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1.2, 0],
              x: [0, (Math.random() - 0.5) * 30],
              y: [0, (Math.random() - 0.5) * 30],
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              duration: 0.8,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        ))}
      </AnimatePresence>
      
      {active && (
        <motion.div
          className="absolute inset-0 border-2 border-red-500/50 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
    </div>
  );
}

export function DataDestructEffect({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <motion.div 
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 border border-red-500/30 rounded-lg" />
      <div className="absolute -inset-1 bg-gradient-to-r from-red-500/0 via-red-500/20 to-red-500/0 animate-pulse" />
      <ShredParticles active={active} count={8} />
    </motion.div>
  );
}
