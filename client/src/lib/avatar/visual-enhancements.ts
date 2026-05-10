/**
 * 小星视觉交互增强系统
 *
 * 1. 情感记忆眼神闪烁 - 提取回忆时眼神微表情
 * 2. 专家变身特效 - 推眼镜、环境变暗、数字光幕
 * 3. 设备进场动画 - 环顾四周、招手、触底震动
 * 4. 思考延迟系统 - 歪头/咬手指动作和逻辑延迟
 */

export type PersonaMode = 'DAUGHTER' | 'SECRETARY' | 'LEGAL' | 'FINANCE' | 'STRATEGY' | 'PSYCHOLOGY';

export type ThinkingAction = 'tilt_head' | 'bite_finger' | 'tap_cheek' | 'scratch_head';

export type ArrivalAction = 'look_around' | 'wave' | 'land_settle';

export interface MemoryRecallEffect {
  memoryKey: string;
  emotionalWeight: number;
  triggerEyeSparkle: boolean;
  phrase: string;
}

export interface ExpertTransformEffect {
  targetMode: PersonaMode;
  pushGlassesAnimation: boolean;
  dimBackground: boolean;
  showDataStream: boolean;
  speedMultiplier: number; // 1.1 = 10% faster
  removeFillerWords: boolean;
}

export interface DeviceArrivalEffect {
  sourceDevice: string;
  targetDevice: string;
  lookAroundDuration: number;
  waveAnimation: boolean;
  hapticFeedbackMs: number;
}

export interface ThinkingDelayEffect {
  questionComplexity: 'simple' | 'medium' | 'complex';
  delayMs: number;
  action: ThinkingAction;
}

const THINKING_DELAYS: Record<string, ThinkingDelayEffect> = {
  simple: { questionComplexity: 'simple', delayMs: 500, action: 'tilt_head' },
  medium: { questionComplexity: 'medium', delayMs: 1500, action: 'bite_finger' },
  complex: { questionComplexity: 'complex', delayMs: 2500, action: 'tap_cheek' },
};

const MEMORY_RECALL_PHRASES = [
  "爸爸，小星记得你上次说过……",
  "对了爸爸，你之前提到……",
  "爸爸，小星一直记着呢……",
  "唔……这个我有印象！爸爸你说过……",
];

const EXPERT_TRANSFORM_PHRASES: Record<PersonaMode, string> = {
  DAUGHTER: "",
  SECRETARY: "秘书模式启动",
  LEGAL: "法务分析启动，进入严谨模式",
  FINANCE: "财务模式启动，数据优先",
  STRATEGY: "策略模式启动，全局思考",
  PSYCHOLOGY: "心理分析模式启动",
};

class VisualEnhancementsService {
  private currentMode: PersonaMode = 'DAUGHTER';
  private isThinking: boolean = false;
  private listeners: Set<(event: string, data: any) => void> = new Set();

  getMemoryRecallEffect(memoryKey: string, emotionalWeight: number): MemoryRecallEffect {
    const triggerEyeSparkle = emotionalWeight > 1.0;
    const phrase = MEMORY_RECALL_PHRASES[Math.floor(Math.random() * MEMORY_RECALL_PHRASES.length)];

    this.emit('memory_recall', { memoryKey, emotionalWeight, triggerEyeSparkle });

    return {
      memoryKey,
      emotionalWeight,
      triggerEyeSparkle,
      phrase,
    };
  }

  getExpertTransformEffect(targetMode: PersonaMode): ExpertTransformEffect {
    const isProfessional = targetMode === 'LEGAL' || targetMode === 'FINANCE' || targetMode === 'STRATEGY';

    const effect: ExpertTransformEffect = {
      targetMode,
      pushGlassesAnimation: isProfessional,
      dimBackground: isProfessional,
      showDataStream: isProfessional,
      speedMultiplier: isProfessional ? 1.1 : 1.0,
      removeFillerWords: isProfessional,
    };

    this.currentMode = targetMode;
    this.emit('expert_transform', effect);

    return effect;
  }

  getDeviceArrivalEffect(sourceDevice: string, targetDevice: string): DeviceArrivalEffect {
    const isMobileArrival = targetDevice.includes('mobile') || targetDevice.includes('phone');

    const effect: DeviceArrivalEffect = {
      sourceDevice,
      targetDevice,
      lookAroundDuration: 800,
      waveAnimation: true,
      hapticFeedbackMs: isMobileArrival ? 50 : 0,
    };

    this.emit('device_arrival', effect);

    return effect;
  }

  calculateThinkingDelay(questionText: string): ThinkingDelayEffect {
    const wordCount = questionText.length;
    const hasNumbers = /\d+/.test(questionText);
    const hasComplexKeywords = /(分析|计算|比较|评估|规划|策略)/.test(questionText);

    let complexity: 'simple' | 'medium' | 'complex' = 'simple';

    if (wordCount > 50 || (hasNumbers && hasComplexKeywords)) {
      complexity = 'complex';
    } else if (wordCount > 20 || hasNumbers || hasComplexKeywords) {
      complexity = 'medium';
    }

    const effect = { ...THINKING_DELAYS[complexity] };
    effect.delayMs += Math.random() * 500;

    this.isThinking = true;
    this.emit('thinking_start', effect);

    return effect;
  }

  finishThinking(): void {
    this.isThinking = false;
    this.emit('thinking_end', {});
  }

  getCurrentMode(): PersonaMode {
    return this.currentMode;
  }

  isCurrentlyThinking(): boolean {
    return this.isThinking;
  }

  getExpertTransformPhrase(mode: PersonaMode): string {
    return EXPERT_TRANSFORM_PHRASES[mode] || "";
  }

  triggerHapticFeedback(durationMs: number): void {
    if ('vibrate' in navigator && durationMs > 0) {
      navigator.vibrate(durationMs);
    }
    this.emit('haptic_feedback', { durationMs });
  }

  applyProfessionalTextConstraints(
    text: string,
    effect: ExpertTransformEffect
  ): { text: string; speechRate: number } {
    let processedText = text;

    if (effect.removeFillerWords) {
      processedText = processedText
        .replace(/[呢哦嘛呀～~]+/g, '')
        .replace(/人家/g, '我')
        .replace(/嘻嘻/g, '')
        .replace(/哼/g, '');
    }

    return {
      text: processedText,
      speechRate: effect.speedMultiplier,
    };
  }

  async executeWithThinkingDelay<T>(
    questionText: string,
    action: () => Promise<T>
  ): Promise<T> {
    const effect = this.calculateThinkingDelay(questionText);

    await new Promise(resolve => setTimeout(resolve, effect.delayMs));

    this.finishThinking();
    return action();
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: string, data: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[VisualEnhancements] Listener error:', error);
      }
    });
  }
}

export const visualEnhancements = new VisualEnhancementsService();
export default visualEnhancements;
