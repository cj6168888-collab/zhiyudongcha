/**
 * 对话服务模块 (Chat Module)
 * 
 * 职责: AI 对话、意图理解、任务提取、情感响应
 */

const chatModules = {
  aiConversation: () => import('../../services/ai-conversation-service'),
  smartConversation: () => import('../../services/smart-conversation'),
  conversationManager: () => import('../../services/conversation-manager'),
  empathicDialogue: () => import('../../services/empathic-dialogue'),
  intentMapper: () => import('../../services/intent-mapper'),
  taskExtractor: () => import('../../services/task-extractor'),
};

export { chatModules };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ConversationContext {
  userId: string;
  messages: ChatMessage[];
  entities: string[];
  intent?: string;
}
