/**
 * ============================================================================
 *     🚀 Phase 0 服务层重构 - 模块化索引
 * ============================================================================
 *
 * 本文件提供服务层的模块化入口
 * 现有服务文件保持位置，通过本索引统一导出
 *
 * 迁移策略: 渐进式 - 保持原有文件，逐步创建模块索引
 *
 * ============================================================================
 */

// 认证模块服务
export const authServices = {
  BiometricAuth: () => import('../services/biometric-auth'),
  SecretVault: () => import('../services/secret-vault'),
  ApiKeyResolver: () => import('../services/api-key-resolver'),
  TieredAccess: () => import('../services/tiered-access'),
};

// 对话模块服务
export const chatServices = {
  AIConversation: () => import('../services/ai-conversation-service'),
  SmartConversation: () => import('../services/smart-conversation'),
  ConversationManager: () => import('../services/conversation-manager'),
  EmpathicDialogue: () => import('../services/empathic-dialogue'),
  IntentMapper: () => import('../services/intent-mapper'),
  TaskExtractor: () => import('../services/task-extractor'),
};

// 记忆模块服务
export const memoryServices = {
  EmotionalMemory: () => import('../services/emotional-memory'),
  SpiritSingleton: () => import('../services/spirit-singleton'),
  VectorMemory: () => import('../services/vector-memory'),
  InsightListener: () => import('../services/insight-listener'),
  DreamService: () => import('../services/dream-service'),
  DreamAnalyzer: () => import('../services/dream-analyzer'),
};

// 语音模块服务
export const voiceServices = {
  AlibabaASR: () => import('../services/alibaba-asr'),
  AzureTTS: () => import('../services/azure-tts'),
  StreamingTTS: () => import('../services/streaming-tts'),
  VoiceCommander: () => import('../services/voice-commander'),
  Voiceprint: () => import('../services/voiceprint'),
  WhisperAssistant: () => import('../services/whisper-assistant'),
  RealtimeVoice: () => import('../services/realtime-voice'),
  VoiceSynthesis: () => import('../services/voice-synthesis'),
};

// 视觉模块服务
export const visionServices = {
  AvatarRecognition: () => import('../services/avatar-recognition'),
  FaceCompare: () => import('../services/face-compare'),
  ContactRecognition: () => import('../services/contact-recognition'),
  SceneRecognition: () => import('../services/scene-recognition'),
  VisualVerification: () => import('../services/visual-verification'),
};

// 知识模块服务
export const knowledgeServices = {
  KnowledgeScheduler: () => import('../services/knowledge-scheduler'),
  ImprovedKnowledgeSearch: () => import('../services/improved-knowledge-search'),
  RagKnowledge: () => import('../services/rag-knowledge'),
  PolicyHarvester: () => import('../services/policy-harvester'),
};

// 设备模块服务
export const deviceServices = {
  DeviceManager: () => import('../services/device-manager'),
  DeviceRegistry: () => import('../services/device-registry'),
  HeartbeatManager: () => import('../services/heartbeat-manager'),
  MobileEdgeAI: () => import('../services/mobile-edge-ai'),
  DeviceSentry: () => import('../services/device-sentry'),
  MigrationCoordinator: () => import('../services/migration-coordinator'),
};

// 安全模块服务
export const securityServices = {
  ThreatDetector: () => import('../services/threat-detector'),
  ImmuneOrchestrator: () => import('../services/immune-orchestrator'),
  BioGuardian: () => import('../services/bio-guardian'),
  CrisisIntervention: () => import('../services/crisis-intervention'),
  PrivacyGrading: () => import('../services/privacy-grading'),
  KillSwitch: () => import('../services/kill-switch'),
};

// 监控模块服务
export const monitorServices = {
  ProactiveEventMonitor: () => import('../services/proactive-event-monitor'),
  TaskExecutionTracker: () => import('../services/task-execution-tracker'),
  TelemetryService: () => import('../services/telemetry-service'),
  FeedbackLogger: () => import('../services/feedback-logger'),
  FailureCollector: () => import('../services/failure-collector'),
  DataLineage: () => import('../services/data-lineage'),
};

// 统一导出
export const services = {
  ...authServices,
  ...chatServices,
  ...memoryServices,
  ...voiceServices,
  ...visionServices,
  ...knowledgeServices,
  ...deviceServices,
  ...securityServices,
  ...monitorServices,
};

// 模块信息
export const moduleInfo = {
  totalServices: 46,
  modules: [
    { name: 'auth', services: Object.keys(authServices).length },
    { name: 'chat', services: Object.keys(chatServices).length },
    { name: 'memory', services: Object.keys(memoryServices).length },
    { name: 'voice', services: Object.keys(voiceServices).length },
    { name: 'vision', services: Object.keys(visionServices).length },
    { name: 'knowledge', services: Object.keys(knowledgeServices).length },
    { name: 'device', services: Object.keys(deviceServices).length },
    { name: 'security', services: Object.keys(securityServices).length },
    { name: 'monitor', services: Object.keys(monitorServices).length },
  ]
};
