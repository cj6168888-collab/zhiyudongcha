import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Sparkles, BrainCircuit, ArrowRight } from 'lucide-react';
import { useOnboardingStore, type InterfaceMode } from '@/lib/onboarding-store';
import { Button } from '@/components/ui/button';

interface SetupModalProps {
  isOpen: boolean;
}

export function SetupModal({ isOpen }: SetupModalProps) {
  const [selectedMode, setSelectedMode] = useState<InterfaceMode | null>(null);
  const { completeSetup } = useOnboardingStore();

  const handleConfirm = () => {
    if (selectedMode) {
      completeSetup(selectedMode);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        data-testid="setup-modal-overlay"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-full max-w-lg bg-gradient-to-b from-[#0f1729] to-[#0a0f1e] rounded-2xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 overflow-hidden"
          data-testid="setup-modal"
        >
          <div className="p-8">
            <div className="flex items-center justify-center mb-6">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="relative"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                  <BrainCircuit className="w-8 h-8 text-cyan-400" />
                </div>
                <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping" />
              </motion.div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-light text-gray-100 mb-2">
                欢迎，主人
              </h2>
              <p className="text-sm text-gray-400 font-mono">
                小星已准备就绪，请选择您偏好的界面风格
              </p>
            </div>

            <div className="flex justify-center gap-6 mb-8">
              <ModeCard
                mode="business"
                title="商务模式"
                description="简洁专业，适合工作场景"
                icon={Briefcase}
                gradientFrom="from-blue-500"
                gradientTo="to-cyan-500"
                borderColor="border-blue-400/30"
                selected={selectedMode === 'business'}
                onSelect={() => setSelectedMode('business')}
              />
              <ModeCard
                mode="anime"
                title="二次元模式"
                description="可爱活泼，更多情感表达"
                icon={Sparkles}
                gradientFrom="from-purple-500"
                gradientTo="to-pink-500"
                borderColor="border-purple-400/30"
                selected={selectedMode === 'anime'}
                onSelect={() => setSelectedMode('anime')}
              />
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleConfirm}
                disabled={!selectedMode}
                className={`px-8 py-3 rounded-lg font-mono text-sm transition-all ${
                  selectedMode
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
                data-testid="button-confirm-setup"
              >
                <span>确认选择</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <p className="text-center text-xs text-gray-600 mt-6 font-mono">
              您可以随时在设置中更改界面模式
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModeCard({
  mode,
  title,
  description,
  icon: Icon,
  gradientFrom,
  gradientTo,
  borderColor,
  selected,
  onSelect,
}: {
  mode: InterfaceMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative p-4 rounded-xl border-2 transition-all ${
        selected
          ? `${borderColor.replace('/30', '')} bg-white/5`
          : 'border-gray-700/50 hover:border-gray-600'
      }`}
      data-testid={`button-mode-${mode}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradientFrom}/30 ${gradientTo}/30 flex items-center justify-center`}
        >
          <div
            className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-gray-200">{title}</div>
          <div className="text-xs text-gray-500 mt-1">{description}</div>
        </div>
      </div>
      {selected && (
        <motion.div
          layoutId="selected-mode"
          className={`absolute inset-0 rounded-xl border-2 ${borderColor.replace('/30', '')}`}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
    </motion.button>
  );
}
