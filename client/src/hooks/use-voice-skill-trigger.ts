/**
 * useVoiceSkillTrigger Hook - 语音触发 OpenClaw 技能
 *
 * 集成现有语音系统，自动检测并执行 OpenClaw 技能
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSkillEngine, type SkillResult } from '@/lib/ai-skill-engine';
import { apiRequest } from '@/lib/queryClient';

// OpenClaw 技能相关的语音指令前缀
const OPENCLAW_VOICE_PREFIXES = [
  '打开', '关闭', '执行', '启动', '运行',
  '截图', '截屏', '保存', '新建', '发送',
  '复制', '粘贴', '剪切', '删除',
  '最大化', '最小化', '全屏', '锁定',
  '新建', '关闭', '刷新', '刷新页面'
];

// 需要设备连接的技能
const DEVICE_DEPENDENT_SKILLS = [
  'screenshot', 'open_app', 'click', 'double_click',
  'type_text', 'hotkey', 'scroll', 'close_window',
  'minimize_window', 'maximize_window', 'switch_tab',
  'refresh', 'save', 'select_all', 'copy_paste',
  // Excel/Word
  'excel_new', 'excel_save', 'excel_new_sheet', 'excel_autosum', 'excel_format_bold',
  'word_new', 'word_save',
  // 浏览器
  'browser_new_tab', 'browser_close_tab', 'browser_reopen_tab', 'browser_new_window',
  'browser_fullscreen', 'browser_bookmark',
  // 文件
  'file_explorer', 'file_new_folder', 'file_rename', 'file_delete', 'file_properties'
];

export interface VoiceSkillTriggerConfig {
  // 是否启用
  enabled: boolean;
  // 是否在识别到 OpenClaw 指令时自动执行
  autoExecute: boolean;
  // 是否在执行后给出语音反馈
  voiceFeedback: boolean;
  // 匹配阈值 (0-1)
  matchThreshold: number;
}

const DEFAULT_CONFIG: VoiceSkillTriggerConfig = {
  enabled: true,
  autoExecute: true,
  voiceFeedback: true,
  matchThreshold: 0.6
};

export interface UseVoiceSkillTriggerReturn {
  // 配置
  config: VoiceSkillTriggerConfig;
  setConfig: (config: Partial<VoiceSkillTriggerConfig>) => void;

  // 状态
  isProcessing: boolean;
  lastResult: SkillResult | null;
  isSkillCommand: boolean;

  // 方法
  processVoiceInput: (text: string) => Promise<SkillResult | null>;
  checkIsSkillCommand: (text: string) => boolean;
  speakResult: (result: SkillResult) => void;
}

/**
 * 语音技能触发 Hook
 *
 * @example
 * const { processVoiceInput, isSkillCommand } = useVoiceSkillTrigger();
 *
 * // 在语音识别回调中调用
 * const result = await processVoiceInput(recognizedText);
 * if (result) {
 *   console.log('技能执行结果:', result);
 * }
 */
export function useVoiceSkillTrigger(
  customConfig?: Partial<VoiceSkillTriggerConfig>
): UseVoiceSkillTriggerReturn {
  const [config, setConfigState] = useState<VoiceSkillTriggerConfig>({
    ...DEFAULT_CONFIG,
    ...customConfig
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<SkillResult | null>(null);
  const [isSkillCommand, setIsSkillCommand] = useState(false);

  const skillEngine = useRef(getSkillEngine());

  // 更新配置
  const setConfig = useCallback((newConfig: Partial<VoiceSkillTriggerConfig>) => {
    setConfigState(prev => ({ ...prev, ...newConfig }));
  }, []);

  // 检查是否是 OpenClaw 技能指令
  const checkIsSkillCommand = useCallback((text: string): boolean => {
    if (!config.enabled) return false;

    const lowerText = text.toLowerCase();

    // 检查前缀
    for (const prefix of OPENCLAW_VOICE_PREFIXES) {
      if (lowerText.includes(prefix)) {
        return true;
      }
    }

    // 检查是否匹配任何技能
    const fuzzyResults = skillEngine.current.fuzzyMatch(text);
    return fuzzyResults.length > 0 && fuzzyResults[0].score >= config.matchThreshold * 100;
  }, [config.enabled, config.matchThreshold]);

  // 语音反馈
  const speakResult = useCallback((result: SkillResult) => {
    if (!config.voiceFeedback || !('speechSynthesis' in window)) return;

    let message: string;
    if (result.success) {
      message = '好的，已完成';
    } else {
      message = result.error || '抱歉，执行失败';
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.2;
    speechSynthesis.speak(utterance);
  }, [config.voiceFeedback]);

  // 处理语音输入
  const processVoiceInput = useCallback(async (text: string): Promise<SkillResult | null> => {
    if (!config.enabled || !text.trim()) return null;

    // 检查是否是技能指令
    if (!checkIsSkillCommand(text)) {
      setIsSkillCommand(false);
      return null;
    }

    setIsSkillCommand(true);
    setIsProcessing(true);

    try {
      // 使用技能引擎处理
      const result = await skillEngine.current.processInstruction(text);

      setLastResult(result);

      if (config.autoExecute) {
        // 语音反馈
        speakResult(result);

        // 显示 Toast
        if (result.success) {
          toast.success('技能执行成功');
        } else {
          toast.error(result.error || '执行失败');
        }
      }

      return result;
    } catch (error) {
      const errorResult: SkillResult = {
        success: false,
        error: error instanceof Error ? error.message : '执行异常',
        duration: 0
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsProcessing(false);
    }
  }, [config.enabled, config.autoExecute, checkIsSkillCommand, speakResult]);

  return {
    config,
    setConfig,
    isProcessing,
    lastResult,
    isSkillCommand,
    processVoiceInput,
    checkIsSkillCommand,
    speakResult
  };
}

/**
 * 创建语音技能处理中间件
 *
 * 可以插入到现有的语音处理流程中
 *
 * @example
 * // 在语音识别结果处理中添加
 * recognition.onresult = (event) => {
 *   const text = event.results[0][0].transcript;
 *   const skillMiddleware = createVoiceSkillMiddleware();
 *   const shouldContinue = await skillMiddleware.process(text);
 *
 *   if (!shouldContinue) {
 *     // 技能已处理，不需要发送到 AI
 *     return;
 *   }
 *
 *   // 继续发送到 AI 处理
 * };
 */
export function createVoiceSkillMiddleware(
  config?: Partial<VoiceSkillTriggerConfig>
) {
  const hook = useVoiceSkillTrigger(config);

  return {
    /**
     * 处理语音输入
     * @returns true 如果需要继续发送到 AI，false 如果技能已处理
     */
    process: async (text: string): Promise<boolean> => {
      const result = await hook.processVoiceInput(text);

      // 如果成功匹配并执行了技能，返回 false（不继续发送到 AI）
      // 如果没有匹配到技能，返回 true（继续发送到 AI）
      return result === null;
    },

    /**
     * 检查是否是技能指令（不执行）
     */
    isSkillCommand: (text: string): boolean => {
      return hook.checkIsSkillCommand(text);
    },

    /**
     * 获取最后的结果
     */
    getLastResult: (): SkillResult | null => {
      return hook.lastResult;
    },

    /**
     * 手动执行技能
     */
    execute: async (text: string): Promise<SkillResult | null> => {
      return await hook.processVoiceInput(text);
    },

    // 暴露配置方法
    setEnabled: (enabled: boolean) => hook.setConfig({ enabled }),
    setAutoExecute: (autoExecute: boolean) => hook.setConfig({ autoExecute })
  };
}

/**
 * 检查设备是否连接（辅助函数）
 */
export async function checkDeviceConnection(): Promise<boolean> {
  try {
    const res = await apiRequest('GET', '/api/remote/devices');
    const json = await res.json();

    if (json.success && json.data) {
      return json.data.some((device: any) => device.status === 'ONLINE');
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 获取需要设备连接的技能列表
 */
export function getDeviceDependentSkills(): string[] {
  return DEVICE_DEPENDENT_SKILLS;
}

export default useVoiceSkillTrigger;
