/**
 * Voice State Manager - 语音状态管理器
 * 
 * 核心功能：
 * 1. 管理语音模块的所有状态
 * 2. 确保录音分析和实时对话的互斥性
 * 3. 提供状态转换规则和验证
 * 4. 支持状态持久化和恢复
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../logger';

const logger = createServiceLogger('VoiceStateManager');

// 语音模式定义
export type VoiceMode = 
  | 'IDLE'           // 空闲 - 未使用任何语音功能
  | 'RECORDING'      // 录音分析模式 - 正在录制音频进行分析
  | 'LISTENING'      // 实时对话-监听模式 - 正在监听用户语音
  | 'SPEAKING'       // 实时对话-说话模式 - 正在播放AI回复
  | 'PROCESSING'     // 处理模式 - AI正在处理语音
  | 'INTERRUPTED';   // 中断模式 - 对话被中断

// 语音事件类型
export type VoiceEvent = 
  | 'START_RECORDING'    // 开始录音
  | 'STOP_RECORDING'     // 停止录音
  | 'START_LISTENING'    // 开始监听
  | 'STOP_LISTENING'     // 停止监听
  | 'START_SPEAKING'     // 开始说话
  | 'STOP_SPEAKING'     // 停止说话
  | 'START_PROCESSING'   // 开始处理
  | 'STOP_PROCESSING'    // 停止处理
  | 'INTERRUPT'          // 中断
  | 'RESET';             // 重置

// 状态转换配置
interface StateTransition {
  from: VoiceMode;
  to: VoiceMode;
  event: VoiceEvent;
  guard?: (currentState: VoiceState) => boolean;
  action?: (currentState: VoiceState) => void;
}

// 语音状态接口
export interface VoiceState {
  mode: VoiceMode;
  previousMode: VoiceMode | null;
  startTime: number;
  lastActivityTime: number;
  transitionHistory: VoiceTransitionRecord[];
  metadata: VoiceStateMetadata;
}

// 转换历史记录
interface VoiceTransitionRecord {
  from: VoiceMode;
  to: VoiceMode;
  event: VoiceEvent;
  timestamp: number;
  reason?: string;
}

// 元数据
interface VoiceStateMetadata {
  sessionId?: string;
  userId?: string;
  audioDeviceId?: string;
  errorCount: number;
  interruptCount: number;
}

// 语音状态管理器类
class VoiceStateManager {
  private currentState: VoiceState;
  private listeners: Set<(state: VoiceState, event: VoiceEvent) => void> = new Set();
  private modeListeners: Set<(mode: VoiceMode) => void> = new Set();
  
  // 状态转换规则
  private transitions: StateTransition[] = [
    // 从 IDLE 出发
    { from: 'IDLE', to: 'RECORDING', event: 'START_RECORDING' },
    { from: 'IDLE', to: 'LISTENING', event: 'START_LISTENING' },
    
    // 从 RECORDING 出发
    { from: 'RECORDING', to: 'IDLE', event: 'STOP_RECORDING' },
    { from: 'RECORDING', to: 'IDLE', event: 'RESET' },
    
    // 从 LISTENING 出发
    { from: 'LISTENING', to: 'PROCESSING', event: 'START_PROCESSING' },
    { from: 'LISTENING', to: 'IDLE', event: 'STOP_LISTENING' },
    { from: 'LISTENING', to: 'INTERRUPTED', event: 'INTERRUPT' },
    
    // 从 PROCESSING 出发
    { from: 'PROCESSING', to: 'SPEAKING', event: 'START_SPEAKING' },
    { from: 'PROCESSING', to: 'IDLE', event: 'RESET' },
    
    // 从 SPEAKING 出发
    { from: 'SPEAKING', to: 'LISTENING', event: 'STOP_SPEAKING' },
    { from: 'SPEAKING', to: 'INTERRUPTED', event: 'INTERRUPT' },
    
    // 从 INTERRUPTED 出发
    { from: 'INTERRUPTED', to: 'LISTENING', event: 'START_LISTENING' },
    { from: 'INTERRUPTED', to: 'IDLE', event: 'RESET' },
  ];

  constructor() {
    this.currentState = this.createInitialState();
    logger.info('[VoiceStateManager] 语音状态管理器已初始化');
  }

  // 创建初始状态
  private createInitialState(): VoiceState {
    return {
      mode: 'IDLE',
      previousMode: null,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      transitionHistory: [],
      metadata: {
        errorCount: 0,
        interruptCount: 0,
      },
    };
  }

  // 获取当前状态
  getState(): VoiceState {
    return { ...this.currentState };
  }

  // 获取当前模式
  getMode(): VoiceMode {
    return this.currentState.mode;
  }

  // 检查是否可以切换到指定模式
  canSwitchTo(mode: VoiceMode): { allowed: boolean; reason?: string } {
    const current = this.currentState.mode;
    
    // 规则1: 从 RECORDING 只能切换到 IDLE
    if (current === 'RECORDING' && mode !== 'IDLE') {
      return { 
        allowed: false, 
        reason: '录音模式进行中，请先停止录音' 
      };
    }
    
    // 规则2: 从 INTERRUPTED 只能切换到 LISTENING 或 IDLE
    if (current === 'INTERRUPTED' && mode !== 'LISTENING' && mode !== 'IDLE') {
      return { 
        allowed: false, 
        reason: '对话中断中，请先恢复监听或重置' 
      };
    }
    
    // 规则3: 检查是否存在直接转换规则
    const hasTransition = this.transitions.some(
      t => t.from === current && t.to === mode
    );
    
    if (!hasTransition) {
      return { 
        allowed: false, 
        reason: `不允许从 ${current} 直接切换到 ${mode}` 
      };
    }
    
    return { allowed: true };
  }

  // 执行状态转换
  transition(event: VoiceEvent, reason?: string): { success: boolean; error?: string } {
    const currentMode = this.currentState.mode;
    
    // 查找转换规则
    const transition = this.transitions.find(
      t => t.from === currentMode && t.event === event
    );
    
    if (!transition) {
      const error = `无效的状态转换: ${currentMode} -[${event}]-> ?`;
      logger.warn(`[VoiceStateManager] ${error}`);
      return { success: false, error };
    }
    
    // 执行守卫检查
    if (transition.guard && !transition.guard(this.currentState)) {
      const error = `状态转换被拒绝: ${currentMode} -[${event}]-> ${transition.to}`;
      logger.warn(`[VoiceStateManager] ${error}`);
      return { success: false, error };
    }
    
    // 执行转换
    const previousMode = currentMode;
    this.currentState = {
      ...this.currentState,
      mode: transition.to,
      previousMode,
      lastActivityTime: Date.now(),
      transitionHistory: [
        ...this.currentState.transitionHistory,
        {
          from: previousMode,
          to: transition.to,
          event,
          timestamp: Date.now(),
          reason,
        },
      ],
    };
    
    // 执行动作
    if (transition.action) {
      transition.action(this.currentState);
    }
    
    // 记录日志
    logger.info(
      `[VoiceStateManager] 状态转换: ${previousMode} -[${event}]-> ${transition.to}`
    );
    
    // 通知监听器
    this.notifyListeners(event);
    
    return { success: true };
  }

  // 检查是否处于录音模式
  isRecording(): boolean {
    return this.currentState.mode === 'RECORDING';
  }

  // 检查是否处于实时对话模式
  isInConversation(): boolean {
    return ['LISTENING', 'PROCESSING', 'SPEAKING', 'INTERRUPTED'].includes(
      this.currentState.mode
    );
  }

  // 检查是否可以发送音频到ASR
  canSendToASR(): { allowed: boolean; reason?: string } {
    // 只有在 LISTENING 模式下才能发送音频
    if (this.currentState.mode !== 'LISTENING') {
      return {
        allowed: false,
        reason: `当前处于 ${this.currentState.mode} 模式，不能发送音频`
      };
    }

    return { allowed: true };
  }

  // 检查是否可以开始录音（与实时对话互斥）
  canStartRecording(): { allowed: boolean; reason?: string } {
    // 实时对话进行中，不能录音
    if (this.isInConversation()) {
      return {
        allowed: false,
        reason: `当前处于 ${this.currentState.mode} 模式，请先停止语音对话`
      };
    }

    return { allowed: true };
  }

  // 检查是否可以开始实时对话（与录音互斥）
  canStartConversation(): { allowed: boolean; reason?: string } {
    // 录音进行中，不能开始实时对话
    if (this.isRecording()) {
      return {
        allowed: false,
        reason: `当前正在录音，请先停止录音`
      };
    }

    return { allowed: true };
  }

  // 获取互斥模式描述
  getMutexDescription(): string {
    const mode = this.currentState.mode;

    const descriptions: Record<VoiceMode, string> = {
      'IDLE': '空闲状态，可以开始任何语音功能',
      'RECORDING': '录音进行中，无法使用实时对话',
      'LISTENING': '正在监听，无法使用录音功能',
      'PROCESSING': 'AI处理中，无法使用录音功能',
      'SPEAKING': 'AI说话中，无法使用录音功能',
      'INTERRUPTED': '对话中断中，无法使用录音功能',
    };

    return descriptions[mode];
  }

  // 设置会话信息
  setSessionInfo(sessionId: string, userId: string): void {
    this.currentState.metadata.sessionId = sessionId;
    this.currentState.metadata.userId = userId;
    logger.info(`[VoiceStateManager] 会话信息已更新: ${sessionId}`);
  }

  // 设置音频设备信息
  setAudioDeviceInfo(deviceId: string): void {
    this.currentState.metadata.audioDeviceId = deviceId;
  }

  // 增加错误计数
  incrementErrorCount(): void {
    this.currentState.metadata.errorCount++;
    logger.warn(
      `[VoiceStateManager] 错误计数增加: ${this.currentState.metadata.errorCount}`
    );
  }

  // 增加中断计数
  incrementInterruptCount(): void {
    this.currentState.metadata.interruptCount++;
    logger.info(
      `[VoiceStateManager] 中断计数增加: ${this.currentState.metadata.interruptCount}`
    );
  }

  // 重置状态
  reset(reason?: string): void {
    const previousMode = this.currentState.mode;
    this.currentState = this.createInitialState();
    
    logger.info(
      `[VoiceStateManager] 状态已重置: ${previousMode} -> IDLE${reason ? ` (${reason})` : ''}`
    );
    
    this.notifyListeners('RESET');
  }

  // 获取状态统计
  getStatistics(): VoiceStatistics {
    const history = this.currentState.transitionHistory;
    const recordingCount = history.filter(t => t.to === 'RECORDING').length;
    const conversationCount = history.filter(t => 
      ['LISTENING', 'PROCESSING', 'SPEAKING'].includes(t.to)
    ).length;
    
    return {
      totalTransitions: history.length,
      recordingCount,
      conversationCount,
      errorCount: this.currentState.metadata.errorCount,
      interruptCount: this.currentState.metadata.interruptCount,
      currentDuration: Date.now() - this.currentState.startTime,
      lastActivityAgo: Date.now() - this.currentState.lastActivityTime,
    };
  }

  // 订阅状态变化
  subscribe(
    listener: (state: VoiceState, event: VoiceEvent) => void,
    modeListener?: (mode: VoiceMode) => void
  ): () => void {
    this.listeners.add(listener);
    if (modeListener) {
      this.modeListeners.add(modeListener);
    }
    
    return () => {
      this.listeners.delete(listener);
      if (modeListener) {
        this.modeListeners.delete(modeListener);
      }
    };
  }

  // 通知监听器
  private notifyListeners(event: VoiceEvent): void {
    const state = this.getState();
    
    this.listeners.forEach(listener => {
      try {
        listener(state, event);
      } catch (error) {
        logger.error(`[VoiceStateManager] 监听器执行错误: ${error}`);
      }
    });
    
    this.modeListeners.forEach(listener => {
      try {
        listener(state.mode);
      } catch (error) {
        logger.error(`[VoiceStateManager] 模式监听器执行错误: ${error}`);
      }
    });
  }

  // 获取状态描述
  getStatusDescription(): string {
    const mode = this.currentState.mode;
    const descriptions: Record<VoiceMode, string> = {
      'IDLE': '🛑 空闲 - 未使用语音功能',
      'RECORDING': '🎙️ 录音中 - 正在录制声音进行分析',
      'LISTENING': '👂 监听中 - 正在等待用户说话',
      'PROCESSING': '🧠 处理中 - AI正在处理语音',
      'SPEAKING': '🔊 播放中 - AI正在回复',
      'INTERRUPTED': '⏸️ 中断 - 对话被中断',
    };
    
    return descriptions[mode];
  }
}

// 统计接口
export interface VoiceStatistics {
  totalTransitions: number;
  recordingCount: number;
  conversationCount: number;
  errorCount: number;
  interruptCount: number;
  currentDuration: number;
  lastActivityAgo: number;
}

// 单例导出
export const voiceStateManager = new VoiceStateManager();

// 便捷函数
export const getVoiceState = () => voiceStateManager.getState();
export const getVoiceMode = () => voiceStateManager.getMode();
export const canSendToASR = () => voiceStateManager.canSendToASR();
export const resetVoiceState = (reason?: string) => voiceStateManager.reset(reason);
export const subscribeVoiceState = (
  listener: (state: VoiceState, event: VoiceEvent) => void,
  modeListener?: (mode: VoiceMode) => void
) => voiceStateManager.subscribe(listener, modeListener);

export default voiceStateManager;