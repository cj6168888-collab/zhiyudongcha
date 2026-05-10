import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Activity } from 'lucide-react';
import { useNativeVoice } from '../hooks/use-native-voice';
import { cn } from '../lib/utils';

interface NativeVoiceButtonProps {
  onVoiceInput?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
};

const iconSizes = {
  sm: 20,
  md: 28,
  lg: 40,
};

export function NativeVoiceButton({
  onVoiceInput,
  className,
  size = 'md',
  variant = 'primary',
}: NativeVoiceButtonProps) {
  const {
    isListening,
    transcript,
    partialTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
  } = useNativeVoice();

  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (transcript && onVoiceInput) {
      onVoiceInput(transcript);
      setShowTranscript(false);
    }
  }, [transcript, onVoiceInput]);

  const handlePress = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
      setShowTranscript(true);
    }
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
    ghost: 'bg-transparent text-zinc-400 hover:text-white',
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={handlePress}
        className={cn(
          'rounded-full flex items-center justify-center shadow-lg',
          'transition-all duration-300',
          variantClasses[variant],
          sizeClasses[size],
          isListening && 'ring-4 ring-violet-500/30'
        )}
        aria-label={isListening ? '停止语音输入' : '开始语音输入'}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative"
            >
              <Activity
                size={iconSizes[size]}
                className="text-red-400 animate-pulse"
              />
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-red-400 whitespace-nowrap">
                听...
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <Mic size={iconSizes[size]} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {showTranscript && (partialTranscript || isListening) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 bg-zinc-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-zinc-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-400">正在识别...</span>
            </div>
            <p className="text-sm text-white font-medium">
              {partialTranscript || '等待说话...'}
            </p>
            {isListening && (
              <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{ width: '50%' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
