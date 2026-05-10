/**
 * 小智 Spine风格骨骼动画头像组件
 * 
 * 功能：
 * 1. 使用抠图后的角色姿势
 * 2. 物理马尾摆动
 * 3. 15度眼神跟随
 * 4. 呼吸状态机 + 透明度微调
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SkeletalAnimationEngine } from '@/lib/avatar/skeletal-animation';
import { motion, useAnimationControls } from 'framer-motion';

import characterSheet from '@assets/Gemini_Generated_Image_1zhswk1zhswk1zhs_1766458578249.png';
import characterPoses from '@assets/Gemini_Generated_Image_b7y4avb7y4avb7y4_1766458737084.png';
import characterExpressions from '@assets/Gemini_Generated_Image_yln2d5yln2d5yln2_(1)_1766458737083.png';

interface SpineAvatarProps {
  width?: number;
  height?: number;
  mode?: 'DEFAULT' | 'WORK' | 'PROTECT';
  pose?: 'front' | 'side' | 'back' | 'sitting' | 'phone_side' | 'phone_back' | 'backpack_front' | 'backpack_side' | 'backpack_back' | 'thinking' | 'looking_left' | 'looking_phone';
  enablePhysics?: boolean;
  enableLookAt?: boolean;
  showDebug?: boolean;
  onInteraction?: (type: string) => void;
}

const POSE_CLIPS: Record<string, { sheet: string; x: number; y: number; w: number; h: number }> = {
  front: { sheet: 'main', x: 0, y: 0, w: 33.33, h: 100 },
  side: { sheet: 'main', x: 33.33, y: 0, w: 33.33, h: 100 },
  back: { sheet: 'main', x: 66.66, y: 0, w: 33.33, h: 100 },
  
  sitting: { sheet: 'poses', x: 0, y: 0, w: 33.33, h: 33.33 },
  phone_side: { sheet: 'poses', x: 33.33, y: 0, w: 33.33, h: 33.33 },
  phone_back: { sheet: 'poses', x: 66.66, y: 0, w: 33.33, h: 33.33 },
  
  looking_left: { sheet: 'poses', x: 0, y: 33.33, w: 33.33, h: 33.33 },
  looking_phone: { sheet: 'poses', x: 33.33, y: 33.33, w: 33.33, h: 33.33 },
  looking_back: { sheet: 'poses', x: 66.66, y: 33.33, w: 33.33, h: 33.33 },
  
  backpack_front: { sheet: 'poses', x: 0, y: 66.66, w: 33.33, h: 33.33 },
  backpack_side: { sheet: 'poses', x: 33.33, y: 66.66, w: 33.33, h: 33.33 },
  backpack_back: { sheet: 'poses', x: 66.66, y: 66.66, w: 33.33, h: 33.33 },

  thinking: { sheet: 'expressions', x: 0, y: 66.66, w: 33.33, h: 33.33 },
  glasses_side: { sheet: 'expressions', x: 33.33, y: 66.66, w: 33.33, h: 33.33 },
  standing_back: { sheet: 'expressions', x: 66.66, y: 66.66, w: 33.33, h: 33.33 },
};

export function SpineAvatar({
  width = 200,
  height = 300,
  mode = 'DEFAULT',
  pose = 'front',
  enablePhysics = true,
  enableLookAt = true,
  showDebug = false,
  onInteraction,
}: SpineAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkeletalAnimationEngine | null>(null);
  const animationFrameRef = useRef<number>(0);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [opacity, setOpacity] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [headTilt, setHeadTilt] = useState(0);
  const [pigtailSwing, setPigtailSwing] = useState({ left: 0, right: 0 });
  const [breathScale, setBreathScale] = useState(1);
  const [eyeBlink, setEyeBlink] = useState(false);
  const [currentPose, setCurrentPose] = useState(pose);
  
  const controls = useAnimationControls();

  useEffect(() => {
    engineRef.current = new SkeletalAnimationEngine();
    engineRef.current.setState('BREATHING');

    const scheduleNextBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      blinkTimerRef.current = setTimeout(() => {
        setEyeBlink(true);
        setTimeout(() => setEyeBlink(false), 150);
        engineRef.current?.triggerBlink();
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();

    return () => {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPose(pose);
  }, [pose]);

  useEffect(() => {
    const animate = () => {
      if (engineRef.current) {
        const { bones, opacity: newOpacity } = engineRef.current.update();
        
        setOpacity(newOpacity);

        const head = bones.get('head');
        if (head) {
          setHeadTilt(head.localAngle * 0.5);
        }

        const pigtailLeft1 = bones.get('pigtail_left_1');
        const pigtailRight1 = bones.get('pigtail_right_1');
        if (pigtailLeft1 && pigtailRight1) {
          setPigtailSwing({
            left: pigtailLeft1.physicsOffset * 0.8,
            right: pigtailRight1.physicsOffset * 0.8,
          });
        }

        const breathPhase = (Date.now() % 3000) / 3000;
        const breathValue = Math.sin(breathPhase * Math.PI * 2) * 0.5 + 0.5;
        setBreathScale(1 + breathValue * 0.015);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!enableLookAt || !containerRef.current || !engineRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - width / 2;
    const y = e.clientY - rect.top - height * 0.3;
    
    engineRef.current.setLookAtTarget({ x, y });
  }, [enableLookAt, width, height]);

  const handleMouseLeave = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.setLookAtTarget(null);
    }
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onInteraction?.('hover');
  }, [onInteraction]);

  const handleClick = useCallback(() => {
    engineRef.current?.triggerHappy();
    onInteraction?.('click');
    
    controls.start({
      scale: [1, 1.05, 1],
      transition: { duration: 0.3 },
    });
  }, [onInteraction, controls]);

  const getModeGlow = () => {
    switch (mode) {
      case 'WORK': return 'rgba(59, 130, 246, 0.4)';
      case 'PROTECT': return 'rgba(239, 68, 68, 0.4)';
      default: return 'rgba(45, 212, 191, 0.3)';
    }
  };

  const getModeIndicatorColor = () => {
    switch (mode) {
      case 'WORK': return '#3b82f6';
      case 'PROTECT': return '#ef4444';
      default: return '#2dd4bf';
    }
  };

  const getSheetImage = (sheetName: string) => {
    switch (sheetName) {
      case 'main': return characterSheet;
      case 'poses': return characterPoses;
      case 'expressions': return characterExpressions;
      default: return characterSheet;
    }
  };

  const getPoseClip = () => {
    return POSE_CLIPS[currentPose] || POSE_CLIPS.front;
  };

  const clip = getPoseClip();

  return (
    <motion.div
      ref={containerRef}
      className="relative overflow-visible cursor-pointer select-none"
      style={{
        width,
        height,
        opacity,
      }}
      animate={controls}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-testid="spine-avatar-container"
    >
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background: getModeGlow(),
          transform: 'scale(0.7)',
          opacity: isHovered ? 0.9 : 0.5,
          transition: 'opacity 0.3s ease',
        }}
      />

      <motion.div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          transform: `scale(${breathScale})`,
        }}
      >
        <div
          className="relative"
          style={{
            width: width,
            height: height,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: `${300 / clip.w * 100}%`,
              height: `${100 / clip.h * 100}%`,
              left: `${-clip.x / clip.w * 100}%`,
              top: `${-clip.y / clip.h * 100}%`,
              transform: `rotate(${headTilt * 0.3}deg)`,
              transformOrigin: 'center 35%',
              filter: eyeBlink ? 'brightness(0.95)' : 'brightness(1)',
              transition: 'filter 0.1s ease',
            }}
          >
            <img
              src={getSheetImage(clip.sheet)}
              alt="小智"
              className="w-full h-full object-cover"
              style={{
                imageRendering: 'auto',
              }}
              draggable={false}
            />
          </div>

          {(currentPose === 'front' || currentPose === 'side') && (
            <>
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '15%',
                  left: '20%',
                  width: '15%',
                  height: '20%',
                  transform: `rotate(${pigtailSwing.left}deg)`,
                  transformOrigin: 'top center',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '15%',
                  right: '20%',
                  width: '15%',
                  height: '20%',
                  transform: `rotate(${pigtailSwing.right}deg)`,
                  transformOrigin: 'top center',
                }}
              />
            </>
          )}
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0.4, 0.8, 0.4],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{
            background: getModeIndicatorColor(),
            boxShadow: `0 0 12px ${getModeIndicatorColor()}`,
          }}
        />
      </motion.div>

      {mode === 'WORK' && (
        <motion.div
          className="absolute top-2 right-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </motion.div>
      )}

      {mode === 'PROTECT' && (
        <motion.div
          className="absolute top-2 right-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </motion.div>
      )}

      {showDebug && (
        <div className="absolute top-0 left-0 bg-black/70 text-white text-xs p-2 rounded">
          <div>Pose: {currentPose}</div>
          <div>Head: {headTilt.toFixed(1)}°</div>
          <div>Pigtails: L{pigtailSwing.left.toFixed(1)}° R{pigtailSwing.right.toFixed(1)}°</div>
          <div>Breath: {breathScale.toFixed(3)}</div>
        </div>
      )}

      {isHovered && (
        <motion.div
          className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap px-3 py-1 rounded-full"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            color: getModeIndicatorColor(),
            backdropFilter: 'blur(4px)',
          }}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {mode === 'WORK' ? '🖥️ 工作模式' : mode === 'PROTECT' ? '🛡️ 守护模式' : '👋 小智在这里~'}
        </motion.div>
      )}
    </motion.div>
  );
}

export default SpineAvatar;
