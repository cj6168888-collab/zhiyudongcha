/**
 * Smart Assistant Services - 极简智能助手服务
 *
 * 核心设计理念：
 * - 扁平化：所有能力通过 AI 统一调度
 * - 智能化：AI 理解一切，自主决策
 * - 极简界面：对话即界面
 */

export { hybridAssistant, default as HybridAssistant } from './HybridAssistant';
export { authorizationManager, default as AuthorizationManager } from './AuthorizationManager';
export { crossDeviceAssistant, default as CrossDeviceAssistant } from './CrossDeviceAssistant';
export type {
  IntentMatch,
  ScenarioCategory,
  UserMessage,
  AssistantResponse
} from './HybridAssistant';
export {
  AuthorizationType,
  AuthorizationScope,
  type Authorization,
  type AuthorizationRequest,
  type AuthorizationResult,
  type AuthorizationOption
} from './AuthorizationManager';
