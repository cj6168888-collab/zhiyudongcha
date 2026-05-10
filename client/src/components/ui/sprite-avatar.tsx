import { motion } from 'framer-motion';
import { HpRing } from './hp-ring';

type AcademicLevel = 'BACHELOR' | 'MASTER' | 'PHD' | 'EXPERT' | 'SAGE';
type SpriteState = 'idle' | 'alert' | 'collaborating' | 'thinking';

interface SpriteAvatarProps {
  level: AcademicLevel;
  state: SpriteState;
  hp: number;
  maxHp: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const levelConfig: Record<AcademicLevel, {
  label: string;
  color: string;
  glow: string;
  features: string[];
}> = {
  BACHELOR: {
    label: '本科',
    color: 'from-blue-400 to-cyan-400',
    glow: 'shadow-blue-500/30',
    features: ['书包', '基础态'],
  },
  MASTER: {
    label: '硕士',
    color: 'from-purple-400 to-blue-400',
    glow: 'shadow-purple-500/30',
    features: ['浮空眼镜', '轻盈'],
  },
  PHD: {
    label: '博士',
    color: 'from-violet-400 to-purple-500',
    glow: 'shadow-violet-500/40',
    features: ['思维链光带', '代码粒子'],
  },
  EXPERT: {
    label: '专家',
    color: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/40',
    features: ['分形披风', '指挥官姿态'],
  },
  SAGE: {
    label: '贤者',
    color: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/50',
    features: ['星环', '全知态'],
  },
};

const sizeMap = {
  sm: { container: 'w-12 h-12', avatar: 'w-8 h-8', ring: 36 },
  md: { container: 'w-20 h-20', avatar: 'w-14 h-14', ring: 56 },
  lg: { container: 'w-32 h-32', avatar: 'w-24 h-24', ring: 96 },
};

export function SpriteAvatar({ level, state, hp, maxHp, size = 'md', className = '' }: SpriteAvatarProps) {
  const config = levelConfig[level];
  const sizeConfig = sizeMap[size];

  const stateAnimations: Record<SpriteState, { scale?: number[]; y?: number[]; rotate?: number[]; transition: { duration: number; repeat: number; ease?: [number, number, number, number] } }> = {
    idle: {
      scale: [1, 1.02, 1],
      y: [0, -2, 0],
      transition: { duration: 3, repeat: Infinity, ease: [0.4, 0, 0.2, 1] },
    },
    alert: {
      scale: [1, 1.1, 1],
      rotate: [0, -5, 5, 0],
      transition: { duration: 0.5, repeat: Infinity },
    },
    collaborating: {
      y: [0, -8, 0],
      transition: { duration: 0.6, repeat: Infinity, ease: [0.4, 0, 0.2, 1] },
    },
    thinking: {
      rotate: [0, 2, -2, 0],
      transition: { duration: 2, repeat: Infinity, ease: [0.4, 0, 0.2, 1] },
    },
  };

  return (
    <div className={`relative ${sizeConfig.container} ${className}`}>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
        <HpRing current={hp} max={maxHp} size={sizeConfig.ring * 0.6} showValue={false} />
      </div>

      <motion.div
        className={`relative ${sizeConfig.avatar} mx-auto mt-3 rounded-full bg-gradient-to-br ${config.color} shadow-lg ${config.glow}`}
        animate={stateAnimations[state]}
      >
        <div className="absolute inset-1 rounded-full bg-card/80 flex items-center justify-center">
          <SpriteIcon level={level} state={state} />
        </div>

        {level === 'PHD' && (
          <ThinkingChain active={state === 'thinking'} />
        )}

        {level === 'EXPERT' && (
          <FractalCloak />
        )}

        {state === 'alert' && (
          <AlertRipple />
        )}

        {state === 'idle' && (
          <BreathingGlow color={config.color} />
        )}
      </motion.div>

      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
        {config.label}
      </div>
    </div>
  );
}

function SpriteIcon({ level, state }: { level: AcademicLevel; state: SpriteState }) {
  const iconClass = "text-foreground";
  
  return (
    <svg className={`w-6 h-6 ${iconClass}`} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8" r="4" opacity="0.9" />
      <ellipse cx="12" cy="18" rx="6" ry="4" opacity="0.7" />
      
      {level === 'BACHELOR' && (
        <rect x="8" y="14" width="8" height="4" rx="1" opacity="0.5" />
      )}
      
      {(level === 'MASTER' || level === 'PHD' || level === 'EXPERT' || level === 'SAGE') && (
        <>
          <rect x="7" y="6" width="3" height="1" rx="0.5" opacity="0.6" />
          <rect x="14" y="6" width="3" height="1" rx="0.5" opacity="0.6" />
        </>
      )}
      
      {level === 'EXPERT' && (
        <path d="M6 12 L12 10 L18 12 L12 22 Z" opacity="0.3" />
      )}
      
      {level === 'SAGE' && (
        <circle cx="12" cy="3" r="2" opacity="0.4" />
      )}
    </svg>
  );
}

function ThinkingChain({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <motion.div
      className="absolute -inset-2 rounded-full border border-violet-400/50"
      animate={{ rotate: 360 }}
      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
    >
      {[0, 90, 180, 270].map(deg => (
        <motion.div
          key={deg}
          className="absolute w-1 h-1 bg-violet-400 rounded-full"
          style={{
            top: '50%',
            left: '50%',
            transform: `rotate(${deg}deg) translateY(-150%)`,
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, delay: deg / 360, repeat: Infinity }}
        />
      ))}
    </motion.div>
  );
}

function FractalCloak() {
  return (
    <motion.div
      className="absolute -inset-1 rounded-full opacity-30"
      style={{
        background: 'conic-gradient(from 0deg, transparent, rgba(251, 191, 36, 0.3), transparent)',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function AlertRipple() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-red-500"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{
            duration: 1.5,
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  );
}

function BreathingGlow({ color }: { color: string }) {
  return (
    <motion.div
      className={`absolute -inset-1 rounded-full bg-gradient-to-br ${color} opacity-20 blur-sm`}
      animate={{ opacity: [0.1, 0.3, 0.1] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function SpriteStateIndicator({ state }: { state: SpriteState }) {
  const stateLabels: Record<SpriteState, { label: string; color: string }> = {
    idle: { label: '休眠中', color: 'text-blue-400' },
    alert: { label: '警戒中', color: 'text-red-400' },
    collaborating: { label: '协作中', color: 'text-green-400' },
    thinking: { label: '推理中', color: 'text-purple-400' },
  };

  const { label, color } = stateLabels[state];

  return (
    <span className={`text-xs font-mono ${color}`}>
      {label}
    </span>
  );
}
