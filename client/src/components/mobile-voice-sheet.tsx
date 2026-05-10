import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Sparkles } from 'lucide-react';
import { useNativeVoice } from '../hooks/use-native-voice';

interface MobileVoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function MobileVoiceSheet({ isOpen, onClose, onSubmit }: MobileVoiceSheetProps) {
  const { isListening, transcript, partialTranscript, startListening, stopListening, error } =
    useNativeVoice();
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (transcript) {
      setShowResult(true);
    }
  }, [transcript]);

  const handleVoicePress = async () => {
    if (isListening) {
      await stopListening();
      if (transcript) {
        onSubmit(transcript);
      }
    } else {
      await startListening();
    }
  };

  const handleSubmit = () => {
    if (transcript) {
      onSubmit(transcript);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 z-50"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <span className="text-sm text-zinc-400">语音输入</span>
              </div>
              <Button variant="outline" onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></Button>
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleVoicePress}
                className={`
                  relative w-24 h-24 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${isListening
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/30'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30'
                  }
                `}
              >
                {isListening ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Mic className="w-10 h-10 text-white" />
                  </motion.div>
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}

                {isListening && (
                  <>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="absolute w-full h-full rounded-full border-2 border-red-400"
                        initial={{ scale: 1, opacity: 0.8 }}
                        animate={{
                          scale: [1, 1.5],
                          opacity: [0.8, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.3,
                        }}
                      />
                    ))}
                  </>
                )}
              </motion.button>

              <motion.p
                key={partialTranscript || 'listening'}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-center text-lg text-white font-medium min-h-[2rem]"
              >
                {isListening
                  ? partialTranscript || '请开始说话...'
                  : transcript
                  ? transcript
                  : '点击开始语音输入'}
              </motion.p>

              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <Button variant="outline" onClick={handleVoicePress}>继续说</Button>
                <Button variant="outline" onClick={handleSubmit}>发送</Button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
