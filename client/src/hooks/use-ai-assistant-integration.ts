/**
 * useAIAssistantIntegration Hook
 *
 * 将 OpenClaw 技能集成到 AI 对话系统
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { useCallback, useState } from 'react';
import { aiAssistantIntegration, type IntentDetectionResult, type SkillResult } from '@/lib/ai-assistant-integration';

export interface UseAIAssistantIntegrationReturn {
  // 意图检测
  detectIntent: (message: string) => IntentDetectionResult | null;

  // 处理消息（自动检测并执行技能）
  processMessage: (message: string) => Promise<{
    shouldExecute: boolean;
    intent: IntentDetectionResult | null;
    skillResult?: SkillResult;
    suggestedResponse?: string;
  }>;

  // 获取可用技能列表
  getAvailableSkills: () => {
    id: string;
    name: string;
    description: string;
    category: string;
    examplePhrases: string[];
  }[];

  // 启用/禁用
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * AI 助手集成 Hook
 *
 * @example
 * const { processMessage, detectIntent, getAvailableSkills } = useAIAssistantIntegration();
 *
 * // 在消息处理函数中调用
 * const result = await processMessage('打开微信');
 * if (result.shouldExecute) {
 *   // 显示执行结果
 *   showToast(result.suggestedResponse);
 * }
 */
export function useAIAssistantIntegration(): UseAIAssistantIntegrationReturn {
  const [isEnabled, setEnabled] = useState(true);

  const detectIntent = useCallback((message: string) => {
    return aiAssistantIntegration.detectIntent(message);
  }, []);

  const processMessage = useCallback(async (message: string) => {
    return await aiAssistantIntegration.processMessage(message);
  }, []);

  const getAvailableSkills = useCallback(() => {
    return aiAssistantIntegration.getAvailableSkills();
  }, []);

  return {
    detectIntent,
    processMessage,
    getAvailableSkills,
    isEnabled,
    setEnabled
  };
}

export default useAIAssistantIntegration;
