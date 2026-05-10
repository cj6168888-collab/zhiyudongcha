import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Sparkles, Check } from 'lucide-react';
import { useBirthStore, AvatarConfig } from '../../lib/birth-state-store';

interface ModeTransferSceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

const INTERFACE_MODES = [
  {
    id: 'business' as const,
    icon: Briefcase,
    name: '商务模式',
    desc: '专业简洁的商务界面',
    features: ['专业数据面板', '商务报表', '效率优先'],
  },
  {
    id: 'anime' as const,
    icon: Sparkles,
    name: '二次元模式',
    desc: '可爱活泼的动漫风格',
    features: ['萌系界面', '趣味动画', '情感互动'],
  },
];

export function ModeTransferScene({ onComplete, avatarConfig }: ModeTransferSceneProps) {
  const { updateAvatarConfig } = useBirthStore();
  const [selectedMode, setSelectedMode] = useState<'business' | 'anime'>(
    avatarConfig.interfaceMode || 'anime'
  );
  const [isTransferring, setIsTransferring] = useState(false);

  const handleModeSelect = (mode: 'business' | 'anime') => {
    setSelectedMode(mode);
    updateAvatarConfig({ interfaceMode: mode });
  };

  const handleComplete = () => {
    setIsTransferring(true);
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-2xl font-bold text-cyan-400 mb-2">
          界面模式选择
        </h1>
        <p className="text-gray-400 text-sm">
          选择您喜欢的界面风格
        </p>
      </motion.div>

      <div className="flex gap-4 mb-10">
        {INTERFACE_MODES.map((mode, index) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;
          
          return (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleModeSelect(mode.id)}
              className={`
                relative w-40 p-5 rounded-2xl border-2 transition-all
                ${isSelected
                  ? 'border-cyan-400 bg-cyan-400/10 scale-105'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                }
              `}
              data-testid={`mode-${mode.id}`}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-gray-900" />
                </motion.div>
              )}
              
              <Icon className={`w-10 h-10 mx-auto mb-3 ${
                isSelected ? 'text-cyan-400' : 'text-gray-500'
              }`} />
              
              <h3 className={`font-medium mb-1 ${
                isSelected ? 'text-white' : 'text-gray-300'
              }`}>
                {mode.name}
              </h3>
              
              <p className="text-xs text-gray-500 mb-3">{mode.desc}</p>
              
              <ul className="space-y-1">
                {mode.features.map(feature => (
                  <li key={feature} className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-cyan-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={handleComplete}
        disabled={isTransferring}
        className={`
          px-10 py-4 rounded-full font-medium text-lg transition-all
          ${isTransferring
            ? 'bg-cyan-600 text-white animate-pulse'
            : 'bg-cyan-500 text-white hover:bg-cyan-400 hover:scale-105'
          }
        `}
        data-testid="button-complete-birth"
      >
        {isTransferring ? (
          <span className="flex items-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              ⚡
            </motion.span>
            正在激活...
          </span>
        ) : (
          '唤醒小智'
        )}
      </motion.button>

      {isTransferring && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-gray-500 text-sm"
        >
          正在将您的数字生命传送到主界面...
        </motion.p>
      )}
    </div>
  );
}
