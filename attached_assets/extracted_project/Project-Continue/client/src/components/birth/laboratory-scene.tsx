import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { 
  useBirthStore, 
  GENE_OPTIONS, 
  CHARACTER_OPTIONS,
  PERSONALITY_OPTIONS,
  AvatarConfig 
} from '../../lib/birth-state-store';

interface LaboratorySceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

export function LaboratoryScene({ onComplete, avatarConfig }: LaboratorySceneProps) {
  const { toggleGene, setCharacterType, updateAvatarConfig } = useBirthStore();
  const [step, setStep] = useState<'character' | 'genes' | 'personality'>('character');

  const canProceed = () => {
    if (step === 'character') return !!avatarConfig.characterType;
    if (step === 'genes') return avatarConfig.selectedGenes.length > 0;
    if (step === 'personality') return !!avatarConfig.personality;
    return false;
  };

  const handleNext = () => {
    if (step === 'character') setStep('genes');
    else if (step === 'genes') setStep('personality');
    else onComplete();
  };

  return (
    <div className="relative flex flex-col items-center h-full px-6 py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl font-bold text-cyan-400 mb-2">
          基因实验室
        </h1>
        <p className="text-gray-400 text-sm">
          {step === 'character' && '选择数字生命的形态'}
          {step === 'genes' && '选择注入的基因能力'}
          {step === 'personality' && '设定性格特质'}
        </p>
      </motion.div>

      <div className="flex gap-3 mb-6">
        {['character', 'genes', 'personality'].map((s, i) => (
          <div
            key={s}
            className={`w-3 h-3 rounded-full transition-colors ${
              s === step ? 'bg-cyan-400' : 
              ['character', 'genes', 'personality'].indexOf(step) > i ? 'bg-cyan-600' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 w-full max-w-md">
        {step === 'character' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            {CHARACTER_OPTIONS.map(option => (
              <button
                key={option.type}
                onClick={() => setCharacterType(option.type)}
                className={`
                  p-4 rounded-xl border-2 transition-all text-left
                  ${avatarConfig.characterType === option.type
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }
                `}
                data-testid={`character-${option.type.toLowerCase()}`}
              >
                <span className="text-3xl mb-2 block">{option.emoji}</span>
                <span className="font-medium text-white block">{option.name}</span>
                <span className="text-xs text-gray-400">{option.desc}</span>
              </button>
            ))}
          </motion.div>
        )}

        {step === 'genes' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-2"
          >
            <p className="text-xs text-gray-500 mb-3 text-center">可多选</p>
            {GENE_OPTIONS.map(option => (
              <button
                key={option.type}
                onClick={() => toggleGene(option.type)}
                className={`
                  w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3
                  ${avatarConfig.selectedGenes.includes(option.type)
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }
                `}
                data-testid={`gene-${option.type.toLowerCase()}`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <div className="flex-1 text-left">
                  <span className="font-medium text-white block">{option.name}</span>
                  <span className="text-xs text-gray-400">{option.desc}</span>
                </div>
                {avatarConfig.selectedGenes.includes(option.type) && (
                  <Check className="w-5 h-5 text-cyan-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}

        {step === 'personality' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            {PERSONALITY_OPTIONS.map(option => (
              <button
                key={option.type}
                onClick={() => updateAvatarConfig({ personality: option.type })}
                className={`
                  p-4 rounded-xl border-2 transition-all text-center
                  ${avatarConfig.personality === option.type
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }
                `}
                data-testid={`personality-${option.type.toLowerCase()}`}
              >
                <span className="font-medium text-white block mb-1">{option.name}</span>
                <span className="text-xs text-gray-400">{option.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canProceed() ? 1 : 0.5 }}
        disabled={!canProceed()}
        onClick={handleNext}
        className={`
          mt-6 px-8 py-3 rounded-full font-medium transition-all
          ${canProceed()
            ? 'bg-cyan-500 text-white hover:bg-cyan-400'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }
        `}
        data-testid="button-next-step"
      >
        {step === 'personality' ? '确认配置' : '下一步'}
      </motion.button>
    </div>
  );
}
