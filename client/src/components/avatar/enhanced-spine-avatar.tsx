/**
 * 增强版 SpineAvatar 组件
 * 
 * 新增功能：
 * 1. 情感记忆眼神闪烁
 * 2. 专家变身特效（推眼镜、数字光幕）
 * 3. 设备进场动画（环顾、招手、触底震动）
 * 4. 思考延迟动作（歪头、咬手指、敲脸颊）
 */

import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { SpineAvatar } from './spine-avatar';
import { 
  visualEnhancements, 
  type PersonaMode, 
  type ThinkingAction,
  type ExpertTransformEffect,
  type DeviceArrivalEffect,
} from '@/lib/avatar/visual-enhancements';

interface EnhancedSpineAvatarProps {
  width?: number;
  height?: number;
  mode?: 'DEFAULT' | 'WORK' | 'PROTECT';
  personaMode?: PersonaMode;
  enableEnhancements?: boolean;
  onInteraction?: (type: string) => void;
}

export interface EnhancedSpineAvatarRef {
  triggerMemoryRecall: (memoryKey: string, emotionalWeight: number) => void;
  triggerExpertTransform: (targetMode: PersonaMode) => Promise<void>;
  triggerDeviceArrival: (sourceDevice: string, targetDevice: string) => Promise<void>;
  triggerThinking: (questionText: string) => Promise<number>;
  finishThinking: () => void;
}

export const EnhancedSpineAvatar = forwardRef<EnhancedSpineAvatarRef, EnhancedSpineAvatarProps>(({
  width = 200,
  height = 300,
  mode = 'DEFAULT',
  personaMode = 'DAUGHTER',
  enableEnhancements = true,
  onInteraction,
}, ref) => {
  const controls = useAnimationControls();
  
  const [eyeSparkle, setEyeSparkle] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformEffect, setTransformEffect] = useState<ExpertTransformEffect | null>(null);
  const [showDataStream, setShowDataStream] = useState(false);
  const [dimBackground, setDimBackground] = useState(false);
  
  const [thinkingAction, setThinkingAction] = useState<ThinkingAction | null>(null);
  const [isArriving, setIsArriving] = useState(false);
  const [arrivalPhase, setArrivalPhase] = useState<'entering' | 'looking' | 'waving' | 'settled'>('settled');
  
  const [currentPose, setCurrentPose] = useState<string>('front');
  const [recallPhrase, setRecallPhrase] = useState<string>('');

  const triggerMemoryRecall = useCallback((memoryKey: string, emotionalWeight: number) => {
    const effect = visualEnhancements.getMemoryRecallEffect(memoryKey, emotionalWeight);
    
    if (effect.triggerEyeSparkle) {
      setRecallPhrase(effect.phrase);
      setEyeSparkle(true);
      controls.start({
        filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1.1)', 'brightness(1)'],
        transition: { duration: 0.6, times: [0, 0.3, 0.6, 1] },
      });
      
      setTimeout(() => {
        setEyeSparkle(false);
        setRecallPhrase('');
      }, 2000);
    }
    
    onInteraction?.('memory_recall');
  }, [controls, onInteraction]);

  const triggerExpertTransform = useCallback(async (targetMode: PersonaMode) => {
    const effect = visualEnhancements.getExpertTransformEffect(targetMode);
    setTransformEffect(effect);
    setIsTransforming(true);
    
    if (effect.pushGlassesAnimation) {
      setCurrentPose('glasses_side');
      await controls.start({
        scale: [1, 0.98, 1.02, 1],
        transition: { duration: 0.5 },
      });
    }
    
    if (effect.dimBackground) {
      setDimBackground(true);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (effect.showDataStream) {
      setShowDataStream(true);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setCurrentPose('front');
    setIsTransforming(false);
    onInteraction?.('expert_transform');
  }, [controls, onInteraction]);

  const triggerDeviceArrival = useCallback(async (sourceDevice: string, targetDevice: string) => {
    const effect = visualEnhancements.getDeviceArrivalEffect(sourceDevice, targetDevice);
    setIsArriving(true);
    
    setArrivalPhase('entering');
    await controls.start({
      x: [-100, 0],
      opacity: [0, 1],
      transition: { duration: 0.4, ease: 'easeOut' },
    });
    
    setArrivalPhase('looking');
    setCurrentPose('looking_left');
    await new Promise(resolve => setTimeout(resolve, effect.lookAroundDuration / 2));
    setCurrentPose('front');
    await new Promise(resolve => setTimeout(resolve, effect.lookAroundDuration / 2));
    
    if (effect.waveAnimation) {
      setArrivalPhase('waving');
      await controls.start({
        rotate: [0, 5, -5, 5, 0],
        transition: { duration: 0.6 },
      });
    }
    
    if (effect.hapticFeedbackMs > 0) {
      visualEnhancements.triggerHapticFeedback(effect.hapticFeedbackMs);
    }
    
    setArrivalPhase('settled');
    setIsArriving(false);
    onInteraction?.('device_arrival');
  }, [controls, onInteraction]);

  const triggerThinking = useCallback(async (questionText: string): Promise<number> => {
    const effect = visualEnhancements.calculateThinkingDelay(questionText);
    setThinkingAction(effect.action);
    
    const animationPromise = (async () => {
      switch (effect.action) {
        case 'tilt_head':
          await controls.start({
            rotate: [0, 8, 8, 0],
            transition: { duration: effect.delayMs / 1000, times: [0, 0.2, 0.8, 1] },
          });
          break;
        case 'bite_finger':
          setCurrentPose('thinking');
          await new Promise(resolve => setTimeout(resolve, effect.delayMs));
          setCurrentPose('front');
          break;
        case 'tap_cheek':
          await controls.start({
            rotate: [0, 5, 5, 0],
            y: [0, -3, -3, 0],
            transition: { duration: effect.delayMs / 1000, times: [0, 0.2, 0.8, 1] },
          });
          break;
        case 'scratch_head':
          await controls.start({
            rotate: [0, -5, -5, 0],
            transition: { duration: effect.delayMs / 1000 },
          });
          break;
      }
    })();
    
    await Promise.all([
      animationPromise,
      new Promise(resolve => setTimeout(resolve, effect.delayMs)),
    ]);
    
    setThinkingAction(null);
    visualEnhancements.finishThinking();
    
    return effect.delayMs;
  }, [controls]);

  const finishThinking = useCallback(() => {
    setThinkingAction(null);
    visualEnhancements.finishThinking();
  }, []);

  useImperativeHandle(ref, () => ({
    triggerMemoryRecall,
    triggerExpertTransform,
    triggerDeviceArrival,
    triggerThinking,
    finishThinking,
  }));

  useEffect(() => {
    if (personaMode !== 'DAUGHTER') {
      const isProfessional = ['LEGAL', 'FINANCE', 'STRATEGY'].includes(personaMode);
      setShowDataStream(isProfessional);
      setDimBackground(isProfessional);
    } else {
      setShowDataStream(false);
      setDimBackground(false);
    }
  }, [personaMode]);

  return (
    <div className="relative" data-testid="enhanced-spine-avatar">
      <AnimatePresence>
        {dimBackground && (
          <motion.div
            className="fixed inset-0 bg-black/40 z-[-1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            data-testid="dim-background"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDataStream && (
          <motion.div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="data-stream"
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-px bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent"
                style={{
                  left: `${10 + i * 12}%`,
                  height: '100%',
                }}
                initial={{ y: '-100%', opacity: 0.3 }}
                animate={{
                  y: ['100%', '-100%'],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: 2 + i * 0.3,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: i * 0.2,
                }}
              />
            ))}
            
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={`num-${i}`}
                className="absolute text-cyan-400/30 font-mono text-xs"
                style={{
                  left: `${5 + i * 20}%`,
                  top: `${20 + i * 15}%`,
                }}
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.4,
                }}
              >
                {Math.random().toString(16).slice(2, 8)}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div animate={controls}>
        <SpineAvatar
          width={width}
          height={height}
          mode={mode}
          pose={currentPose as any}
          onInteraction={onInteraction}
        />
      </motion.div>

      <AnimatePresence>
        {eyeSparkle && (
          <motion.div
            className="absolute top-[30%] left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.4 }}
            data-testid="eye-sparkle"
          >
            <div className="relative">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                  style={{
                    transform: `rotate(${i * 90}deg) translateY(-8px)`,
                  }}
                  animate={{
                    scale: [1, 1.5, 0],
                    opacity: [1, 1, 0],
                  }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.1,
                  }}
                />
              ))}
              <div className="w-2 h-2 bg-yellow-200 rounded-full shadow-lg shadow-yellow-400/50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recallPhrase && (
          <motion.div
            className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-testid="recall-phrase"
          >
            <div className="bg-amber-900/80 text-amber-100 px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm border border-amber-600/30">
              {recallPhrase}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {thinkingAction && (
          <motion.div
            className="absolute top-0 right-0 w-6 h-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            exit={{ scale: 0 }}
            transition={{ rotate: { duration: 1, repeat: Infinity } }}
            data-testid="thinking-indicator"
          >
            <div className="w-full h-full rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xs">💭</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransforming && transformEffect && (
          <motion.div
            className="absolute bottom-[-20px] left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            data-testid="transform-indicator"
          >
            <div className="text-xs text-cyan-300 font-mono whitespace-nowrap">
              {visualEnhancements.getExpertTransformPhrase(transformEffect.targetMode)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isArriving && arrivalPhase === 'waving' && (
          <motion.div
            className="absolute bottom-[-20px] left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-lg">👋</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

EnhancedSpineAvatar.displayName = 'EnhancedSpineAvatar';

export default EnhancedSpineAvatar;
