/**
 * Presence Detection Pipeline (存在检测管道)
 * 
 * 整合声纹验证和设备事件，实现自动模式切换：
 * - SOLO_MODE (独处模式): 主人独处时，完整UI和语音输出
 * - GUEST_PRESENCE (有客模式): 检测到陌生声纹，隐藏UI，仅蓝牙输出
 * - EMERGENCY_STATE (紧急状态): 安全威胁，静默隐身模式
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('PresenceDetection');

import { InteractionMode, InteractionModality, INTERACTION_CONFIGS } from '../core/constitution';
import { verifyVoiceprint, type VoiceSample, type VerificationResult } from './voiceprint';

export interface DeviceEvent {
  type: 'BLUETOOTH_CONNECTED' | 'BLUETOOTH_DISCONNECTED' | 'SCREEN_LOCK' | 'SCREEN_UNLOCK' | 
        'HEADPHONE_CONNECTED' | 'HEADPHONE_DISCONNECTED' | 'VOICE_DETECTED' | 'SHAKE_DETECTED' |
        'LOCATION_CHANGE' | 'NETWORK_CHANGE' | 'AMBIENT_NOISE_HIGH' | 'AMBIENT_NOISE_LOW';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PresenceState {
  currentMode: InteractionMode;
  modality: InteractionModality;
  lastVoiceVerification?: VerificationResult;
  lastDeviceEvent?: DeviceEvent;
  guestDetected: boolean;
  masterPresent: boolean;
  lastMasterActivity: Date;
  emergencyTriggered: boolean;
}

export interface ModeTransition {
  from: InteractionMode;
  to: InteractionMode;
  reason: string;
  timestamp: Date;
}

const MASTER_INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5分钟无活动
const EMERGENCY_KEYWORDS = ['紧急', 'emergency', '危险', 'danger', '帮助', 'help'];

let currentState: PresenceState = {
  currentMode: InteractionMode.SOLO_MODE,
  modality: INTERACTION_CONFIGS[InteractionMode.SOLO_MODE],
  guestDetected: false,
  masterPresent: true,
  lastMasterActivity: new Date(),
  emergencyTriggered: false,
};

const modeTransitionHistory: ModeTransition[] = [];

export function getCurrentPresenceState(): PresenceState {
  return { ...currentState };
}

export function getModeTransitionHistory(): ModeTransition[] {
  return [...modeTransitionHistory];
}

export function processVoiceEvent(
  voiceSample: VoiceSample,
  masterVoiceTemplate: number[] | null
): { newMode: InteractionMode; transition?: ModeTransition } {
  logger.info(`[PresenceDetection] 处理声音事件`);
  
  if (!masterVoiceTemplate || masterVoiceTemplate.length === 0) {
    logger.info(`[PresenceDetection] 无主人声纹模板，保持当前模式`);
    return { newMode: currentState.currentMode };
  }
  
  const verificationResult = verifyVoiceprint(voiceSample, masterVoiceTemplate);
  currentState.lastVoiceVerification = verificationResult;
  
  if (verificationResult.isMatch) {
    logger.info(`[PresenceDetection] 主人声纹验证通过，置信度: ${(verificationResult.confidence * 100).toFixed(1)}%`);
    currentState.masterPresent = true;
    currentState.lastMasterActivity = new Date();
    
    if (currentState.currentMode !== InteractionMode.SOLO_MODE && !currentState.emergencyTriggered) {
      return transitionToMode(InteractionMode.SOLO_MODE, '主人声纹验证通过');
    }
  } else {
    logger.info(`[PresenceDetection] 检测到陌生声纹，置信度: ${(verificationResult.confidence * 100).toFixed(1)}%`);
    currentState.guestDetected = true;
    
    if (currentState.currentMode === InteractionMode.SOLO_MODE) {
      return transitionToMode(InteractionMode.GUEST_PRESENCE, '检测到陌生声纹');
    }
  }
  
  return { newMode: currentState.currentMode };
}

export function processDeviceEvent(event: DeviceEvent): { newMode: InteractionMode; transition?: ModeTransition } {
  logger.info(`[PresenceDetection] 处理设备事件: ${event.type}`);
  currentState.lastDeviceEvent = event;
  
  switch (event.type) {
    case 'BLUETOOTH_CONNECTED':
    case 'HEADPHONE_CONNECTED':
      if (currentState.guestDetected && currentState.currentMode !== InteractionMode.GUEST_PRESENCE) {
        return transitionToMode(InteractionMode.GUEST_PRESENCE, '蓝牙/耳机连接，切换私密模式');
      }
      break;
      
    case 'BLUETOOTH_DISCONNECTED':
    case 'HEADPHONE_DISCONNECTED':
      if (currentState.masterPresent && !currentState.guestDetected) {
        return transitionToMode(InteractionMode.SOLO_MODE, '蓝牙/耳机断开，恢复完整模式');
      }
      break;
      
    case 'SCREEN_LOCK':
      currentState.masterPresent = false;
      break;
      
    case 'SCREEN_UNLOCK':
      currentState.masterPresent = true;
      currentState.lastMasterActivity = new Date();
      if (!currentState.guestDetected && currentState.currentMode !== InteractionMode.SOLO_MODE) {
        return transitionToMode(InteractionMode.SOLO_MODE, '屏幕解锁，恢复独处模式');
      }
      break;
      
    case 'SHAKE_DETECTED':
      if (currentState.emergencyTriggered) {
        currentState.emergencyTriggered = false;
        return transitionToMode(InteractionMode.SOLO_MODE, '摇晃检测，解除紧急状态');
      }
      break;
      
    case 'AMBIENT_NOISE_HIGH':
      currentState.guestDetected = true;
      if (currentState.currentMode === InteractionMode.SOLO_MODE) {
        return transitionToMode(InteractionMode.GUEST_PRESENCE, '环境噪音升高，可能有人接近');
      }
      break;
      
    case 'AMBIENT_NOISE_LOW':
      if (currentState.masterPresent) {
        currentState.guestDetected = false;
        if (currentState.currentMode === InteractionMode.GUEST_PRESENCE) {
          return transitionToMode(InteractionMode.SOLO_MODE, '环境安静，恢复独处模式');
        }
      }
      break;
      
    case 'LOCATION_CHANGE':
    case 'NETWORK_CHANGE':
      logger.info(`[PresenceDetection] 位置/网络变化，重置访客检测状态`);
      currentState.guestDetected = false;
      break;
  }
  
  return { newMode: currentState.currentMode };
}

export function triggerEmergencyMode(reason: string): ModeTransition {
  logger.info(`[PresenceDetection] ⚠️ 紧急模式触发: ${reason}`);
  currentState.emergencyTriggered = true;
  const result = transitionToMode(InteractionMode.EMERGENCY_STATE, `紧急: ${reason}`);
  return result.transition!;
}

export function clearEmergencyMode(masterConfirmed: boolean): { newMode: InteractionMode; transition?: ModeTransition } {
  if (!masterConfirmed) {
    logger.info(`[PresenceDetection] 需要主人确认才能解除紧急状态`);
    return { newMode: currentState.currentMode };
  }
  
  logger.info(`[PresenceDetection] 主人确认，解除紧急状态`);
  currentState.emergencyTriggered = false;
  return transitionToMode(InteractionMode.SOLO_MODE, '主人确认解除紧急状态');
}

export function checkTextForEmergency(text: string): boolean {
  const lowerText = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

export function checkMasterInactivity(): { inactive: boolean; duration: number } {
  const now = new Date();
  const duration = now.getTime() - currentState.lastMasterActivity.getTime();
  return {
    inactive: duration > MASTER_INACTIVITY_THRESHOLD_MS,
    duration,
  };
}

export function updateMasterActivity(): void {
  currentState.masterPresent = true;
  currentState.lastMasterActivity = new Date();
  
  if (currentState.currentMode === InteractionMode.GUEST_PRESENCE && !currentState.guestDetected) {
    transitionToMode(InteractionMode.SOLO_MODE, '主人活动检测，恢复独处模式');
  }
}

export function clearGuestPresence(): { newMode: InteractionMode; transition?: ModeTransition } {
  logger.info(`[PresenceDetection] 清除访客状态`);
  currentState.guestDetected = false;
  
  if (currentState.currentMode === InteractionMode.GUEST_PRESENCE) {
    return transitionToMode(InteractionMode.SOLO_MODE, '访客离开确认');
  }
  
  return { newMode: currentState.currentMode };
}

function transitionToMode(
  newMode: InteractionMode,
  reason: string
): { newMode: InteractionMode; transition: ModeTransition } {
  const oldMode = currentState.currentMode;
  
  const transition: ModeTransition = {
    from: oldMode,
    to: newMode,
    reason,
    timestamp: new Date(),
  };
  
  currentState.currentMode = newMode;
  currentState.modality = INTERACTION_CONFIGS[newMode];
  
  modeTransitionHistory.push(transition);
  if (modeTransitionHistory.length > 100) {
    modeTransitionHistory.shift();
  }
  
  logger.info(`[PresenceDetection] 模式切换: ${oldMode} → ${newMode} (${reason})`);
  
  return { newMode, transition };
}

export function resetPresenceState(): void {
  currentState = {
    currentMode: InteractionMode.SOLO_MODE,
    modality: INTERACTION_CONFIGS[InteractionMode.SOLO_MODE],
    guestDetected: false,
    masterPresent: true,
    lastMasterActivity: new Date(),
    emergencyTriggered: false,
  };
  modeTransitionHistory.length = 0;
  logger.info(`[PresenceDetection] 存在状态已重置`);
}

logger.info('[PresenceDetection] 存在检测管道已加载');
