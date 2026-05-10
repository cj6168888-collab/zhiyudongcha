/**
 * Agent Services - 自主 Agent 服务模块
 *
 * 导出所有 Agent 相关服务
 */

export { browserAgent, default as BrowserAgent } from './BrowserAgent';
export type { BrowserProfile, WebAction, ExecutionResult, PageSnapshot, PageElement } from './BrowserAgent';

export { governmentFormService, default as GovernmentFormService } from './GovernmentFormService';
export type {
  CompanyInfo,
  GovernmentWebsite,
  FormPage,
  FormField,
  FormSubmissionResult,
  ApplicationStatus
} from './GovernmentFormService';

export { websiteMonitorService, default as WebsiteMonitorService } from './WebsiteMonitorService';
export type {
  WebsiteCredential,
  CheckPattern,
  MonitorConfig,
  CheckResult,
  PatternMatch,
  MonitorSession
} from './WebsiteMonitorService';

export { autonomousAgent, default as AutonomousAgentOrchestrator } from './AutonomousAgentOrchestrator';
export type {
  AgentStep,
  AgentTask,
  ExecutionResult as AgentExecutionResult,
  StepResult,
  AgentContext
} from './AutonomousAgentOrchestrator';

export { naturalLanguageAgent, default as NaturalLanguageAgent } from './NaturalLanguageAgent';
export type {
  UserIntent,
  TaskPlan,
  ExecutionStep,
  ExecutionResult as NLExecutionResult
} from './NaturalLanguageAgent';

export { proactiveAgent, default as ProactiveAgent } from './ProactiveAgent';
export type {
  ConversationContext,
  ExtractedCommitment,
  Action,
  ProactiveResult
} from './ProactiveAgent';

export { voicePrintAgent, default as VoicePrintAgent } from './VoicePrintAgent';
export type {
  Speaker,
  DialogueSegment,
  DialogueAnalysis,
  Commitment,
  Action as DialogueAction
} from './VoicePrintAgent';

export { recommendationEngine, default as RecommendationEngine } from './RecommendationEngine';
export type {
  Restaurant,
  Hotel,
  Recommendation,
  RecommendedAction,
  BookingRequest,
  BookingResult
} from './RecommendationEngine';

export { meetingAgent, default as MeetingAgent } from './MeetingAgent';
export type {
  Meeting,
  Participant,
  Material,
  AgendaItem,
  Task,
  MeetingRequest,
  MeetingResult
} from './MeetingAgent';
