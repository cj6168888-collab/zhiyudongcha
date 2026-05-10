import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AvatarConfig, AvatarGender, AvatarPersonality, AvatarVoice, PERSONALITY_OPTIONS, VOICE_OPTIONS, useBirthStore } from '../../lib/birth-state-store';

interface SceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

const GENDER_OPTIONS: { type: AvatarGender; emoji: string; name: string }[] = [
  { type: 'FEMALE', emoji: '👧', name: '女孩' },
  { type: 'MALE', emoji: '👦', name: '男孩' },
  { type: 'NEUTRAL', emoji: '🌟', name: '中性' },
];

export function NamingCeremonyScene({ onComplete }: SceneProps) {
  const { avatarConfig, updateAvatarConfig } = useBirthStore();
  const [step, setStep] = useState<'name' | 'gender' | 'personality' | 'voice'>('name');
  const [inputName, setInputName] = useState(avatarConfig.name);

  const handleNameSubmit = useCallback(() => {
    if (inputName.trim()) {
      updateAvatarConfig({ name: inputName.trim() });
      setStep('gender');
    }
  }, [inputName, updateAvatarConfig]);

  const handleGenderSelect = useCallback((gender: AvatarGender) => {
    updateAvatarConfig({ gender });
    setStep('personality');
  }, [updateAvatarConfig]);

  const handlePersonalitySelect = useCallback((personality: AvatarPersonality) => {
    updateAvatarConfig({ personality });
    setStep('voice');
  }, [updateAvatarConfig]);

  const handleVoiceSelect = useCallback((voice: AvatarVoice) => {
    updateAvatarConfig({ voice });
    setTimeout(onComplete, 500);
  }, [updateAvatarConfig, onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center" data-testid="scene-naming-ceremony">
      <div className="absolute inset-0 bg-gradient-radial from-amber-950/10 via-transparent to-transparent" />

      <div className="relative z-10 w-full max-w-lg px-4">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-amber-300 mb-2">命名仪式</h2>
          <p className="text-gray-500 text-sm font-mono">NAMING CEREMONY</p>
        </motion.div>

        <motion.div
          className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {step === 'name' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="text-center">
                <p className="text-gray-400 mb-4">请为你的数字生命取一个名字</p>
                <div className="relative">
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => {
                      setInputName(e.target.value)
                    }}
                    placeholder="输入名字..."
                    className="w-full bg-gray-800/50 border border-amber-500/30 rounded-xl px-4 py-3 text-center text-xl text-amber-300 placeholder-gray-600 focus:outline-none focus:border-amber-400"
                    maxLength={10}
                    data-testid="input-avatar-name"
                  />
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{
                      boxShadow: [
                        '0 0 10px rgba(251, 191, 36, 0)',
                        '0 0 20px rgba(251, 191, 36, 0.2)',
                        '0 0 10px rgba(251, 191, 36, 0)',
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  />
                </div>
              </div>
              <motion.button
                onClick={handleNameSubmit}
                disabled={!inputName.trim()}
                className={`w-full py-3 rounded-xl font-medium transition-all ${
                  inputName.trim()
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                whileHover={inputName.trim() ? { scale: 1.02 } : {}}
                whileTap={inputName.trim() ? { scale: 0.98 } : {}}
                data-testid="button-confirm-name"
              >
                确认名字
              </motion.button>
            </motion.div>
          )}

          {step === 'gender' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <p className="text-center text-gray-400 mb-4">选择{avatarConfig.name}的形态</p>
              <div className="grid grid-cols-3 gap-3">
                {GENDER_OPTIONS.map((option) => (
                  <motion.button
                    key={option.type}
                    onClick={() => handleGenderSelect(option.type)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      avatarConfig.gender === option.type
                        ? 'border-amber-400 bg-amber-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-amber-600'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    data-testid={`button-gender-${option.type.toLowerCase()}`}
                  >
                    <div className="text-3xl mb-2">{option.emoji}</div>
                    <div className="text-sm text-gray-300">{option.name}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'personality' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <p className="text-center text-gray-400 mb-4">选择{avatarConfig.name}的性格</p>
              <div className="grid grid-cols-2 gap-3">
                {PERSONALITY_OPTIONS.map((option) => (
                  <motion.button
                    key={option.type}
                    onClick={() => handlePersonalitySelect(option.type)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      avatarConfig.personality === option.type
                        ? 'border-amber-400 bg-amber-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-amber-600'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-testid={`button-personality-${option.type.toLowerCase()}`}
                  >
                    <div className="text-sm font-medium text-amber-300">{option.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.desc}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'voice' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <p className="text-center text-gray-400 mb-4">选择{avatarConfig.name}的声音</p>
              <div className="grid grid-cols-2 gap-3">
                {VOICE_OPTIONS.map((option) => (
                  <motion.button
                    key={option.type}
                    onClick={() => handleVoiceSelect(option.type)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      avatarConfig.voice === option.type
                        ? 'border-amber-400 bg-amber-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-amber-600'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-testid={`button-voice-${option.type.toLowerCase()}`}
                  >
                    <div className="text-sm font-medium text-amber-300">{option.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.desc}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className="mt-6 flex justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {['name', 'gender', 'personality', 'voice'].map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                s === step ? 'bg-amber-400 w-6' : i < ['name', 'gender', 'personality', 'voice'].indexOf(step) ? 'bg-amber-600' : 'bg-gray-700'
              }`}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
