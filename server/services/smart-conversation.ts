/**
 * 智能对话服务 - 语音/文字指令到功能执行的核心链路
 * 
 * 接收用户输入 → AI理解意图 → 调用对应工具 → 返回执行结果
 */

import { chatWithDashScope, executeAvatarCommand, type ChatMessage, type AvatarCommand } from './dashscope';
import { functionCallingService, type ToolCall } from './function-calling';
import type { IStorage } from '../storage';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('SmartConversation');

interface ConversationContext {
  userId: string;
  history: ChatMessage[];
  lastCommand?: AvatarCommand;
}

interface ConversationResult {
  success: boolean;
  response: string;
  action?: string;
  entity?: string;
  toolsCalled?: {
    name: string;
    result: unknown;
  }[];
  chainOfThought?: {
    situation: string;
    variables: string[];
    conclusion: string;
  };
}

const conversationContexts = new Map<string, ConversationContext>();

export async function processUserInput(
  userId: string,
  input: string,
  storage: IStorage,
  options: { useHistory?: boolean; executeCommand?: boolean } = {}
): Promise<ConversationResult> {
  logger.info({ userId, input }, '处理用户输入');
  
  let context = conversationContexts.get(userId);
  if (!context) {
    context = {
      userId,
      history: [],
    };
    conversationContexts.set(userId, context);
  }
  
  const messages: ChatMessage[] = [];
  
  if (options.useHistory && context.history.length > 0) {
    const recentHistory = context.history.slice(-6);
    messages.push(...recentHistory);
  }
  
  messages.push({ role: 'user', content: input });
  
  try {
    const command = await chatWithDashScope(messages, input, storage);
    
    logger.info({ 
      action: command.action, 
      entity: command.entity,
      message: command.message.substring(0, 50) 
    }, 'AI命令解析完成');
    
    context.lastCommand = command;
    
    let finalResponse = command.message;
    const toolResults: { name: string; result: unknown }[] = [];
    
    if (options.executeCommand !== false && command.action !== 'chat') {
      try {
        const result = await executeAvatarCommand(command, storage);
        
        if (result.success) {
          finalResponse = result.message || command.message;
          toolResults.push({
            name: `${command.action}_${command.entity || 'general'}`,
            result: result.data,
          });
        } else {
          finalResponse = result.message || '执行过程中遇到问题';
        }
        
        logger.info({ 
          action: command.action, 
          success: result.success 
        }, '命令执行完成');
        
      } catch (execError) {
        logger.error({ err: execError }, '命令执行失败');
        finalResponse = '抱歉，执行过程中遇到问题，请稍后再试。';
      }
    }
    
    context.history.push({ role: 'user', content: input });
    context.history.push({ role: 'assistant', content: finalResponse });
    
    if (context.history.length > 20) {
      context.history = context.history.slice(-10);
    }
    
    return {
      success: true,
      response: finalResponse,
      action: command.action,
      entity: command.entity,
      toolsCalled: toolResults.length > 0 ? toolResults : undefined,
      chainOfThought: command.chainOfThought ? {
        situation: command.chainOfThought.situation,
        variables: command.chainOfThought.variables,
        conclusion: command.chainOfThought.actions.join('; '),
      } : undefined,
    };
    
  } catch (error) {
    logger.error({ err: error }, '处理用户输入失败');
    return {
      success: false,
      response: '抱歉，我现在有点问题，请稍后再试。',
    };
  }
}

export async function processVoiceCommand(
  userId: string,
  voiceText: string,
  storage: IStorage
): Promise<ConversationResult> {
  logger.info({ userId, voiceText }, '处理语音命令');
  
  return processUserInput(userId, voiceText, storage, {
    useHistory: true,
    executeCommand: true,
  });
}

export function clearConversationHistory(userId: string): void {
  conversationContexts.delete(userId);
  logger.info({ userId }, '清除对话历史');
}

export function getConversationHistory(userId: string): ChatMessage[] {
  const context = conversationContexts.get(userId);
  return context?.history || [];
}

export function getConversationStats(): {
  activeConversations: number;
  totalMessages: number;
} {
  let totalMessages = 0;
  const contexts = Array.from(conversationContexts.values());
  for (const ctx of contexts) {
    totalMessages += ctx.history.length;
  }
  
  return {
    activeConversations: conversationContexts.size,
    totalMessages,
  };
}

export default {
  processUserInput,
  processVoiceCommand,
  clearConversationHistory,
  getConversationHistory,
  getConversationStats,
};
