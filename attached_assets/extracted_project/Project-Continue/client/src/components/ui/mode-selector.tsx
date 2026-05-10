import { motion } from 'framer-motion';
import { Briefcase, Sparkles } from 'lucide-react';

type ViewMode = 'business' | 'anime';

interface ModeSelectorProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function ModeSelector({ mode, onModeChange, className = '' }: ModeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 p-1 bg-muted/50 rounded-lg ${className}`}>
      <ModeButton
        active={mode === 'business'}
        onClick={() => onModeChange('business')}
        icon={Briefcase}
        label="商务"
        activeColor="bg-blue-600"
      />
      <ModeButton
        active={mode === 'anime'}
        onClick={() => onModeChange('anime')}
        icon={Sparkles}
        label="二次元"
        activeColor="bg-purple-600"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  activeColor: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? `${activeColor} text-white shadow-lg`
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      {active && (
        <motion.div
          layoutId="mode-indicator"
          className="absolute inset-0 rounded-md border-2 border-white/20"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
    </motion.button>
  );
}

export function GenesisModeBalls({
  onBusinessSelect,
  onAnimeSelect,
}: {
  onBusinessSelect: () => void;
  onAnimeSelect: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-12">
      <motion.button
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onBusinessSelect}
        className="relative group"
      >
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 backdrop-blur border border-blue-400/30 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Briefcase className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-medium text-blue-400 whitespace-nowrap">
          商务模式
        </div>
        <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.button>

      <motion.button
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAnimeSelect}
        className="relative group"
      >
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 backdrop-blur border border-purple-400/30 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-medium text-purple-400 whitespace-nowrap">
          二次元模式
        </div>
        <div className="absolute inset-0 rounded-full bg-purple-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.button>
    </div>
  );
}
