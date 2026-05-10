/**
 * 服务领域分组架构
 *
 * 将148个服务文件按业务领域分组
 *
 * 10个核心领域:
 * 1. ai        - AI对话与智能服务
 * 2. voice     - 语音服务
 * 3. vision    - 视觉与屏幕服务
 * 4. memory    - 记忆与情感服务
 * 5. device    - 设备管理服务
 * 6. knowledge - 知识与RAG服务
 * 7. project   - 项目管理服务
 * 8. system    - 系统功能服务
 * 9. security  - 安全与监控服务
 * 10. platform - 平台基础服务
 */

export const SERVICE_GROUPS = {
  ai: [
    'ai-conversation',
    'smart-filter',
    'intent-classifier',
    'empathic-response',
    'hybrid-ai',
    'function-calling',
    'expert-orchestrator',
    'wisdom-distribution',
    'personality-core',
    'emotional-memory',
    'navigator-core',
  ],

  voice: [
    'alibaba-asr',
    'voice-processing',
    'streaming-tts',
    'voice-commander',
    'realtime-voice',
    'whisper',
  ],

  vision: [
    'screen-capture',
    'screen-analyzer',
    'scene-recognition',
    'document-decoder',
    'ar-inmo',
  ],

  memory: [
    'shadow-memory',
    'dream-log',
    'relationship-graph',
    'spirit-singleton',
    'insight-listener',
  ],

  device: [
    'z3-device',
    'z6-compute',
    'mobile-edge',
    'laptop-device',
    'satellite-device',
  ],

  knowledge: [
    'knowledge-base',
    'rag-service',
    'skill-learner',
    'embedding-service',
  ],

  project: [
    'project-manager',
    'battle-report',
    'strategy-planner',
    'opportunity-tracker',
  ],

  system: [
    'email-service',
    'calendar-service',
    'task-extractor',
    'notification-service',
    'scheduler-service',
  ],

  security: [
    'auth-service',
    'biometric-auth',
    'security-audit',
    'privacy-guard',
    'immune-system',
  ],

  platform: [
    'cache-service',
    'resilience',
    'rate-limiter',
    'monitoring',
    'logger',
  ],
} as const;

export type ServiceDomain = keyof typeof SERVICE_GROUPS;

export function getServiceGroup(serviceName: string): ServiceDomain | null {
  for (const [group, services] of Object.entries(SERVICE_GROUPS)) {
    if ((services as readonly string[]).includes(serviceName)) {
      return group as ServiceDomain;
    }
  }
  return null;
}

export function getServicesByGroup(group: ServiceDomain): readonly string[] {
  return SERVICE_GROUPS[group] || [];
}

export function getAllServiceGroups(): ServiceDomain[] {
  return Object.keys(SERVICE_GROUPS) as ServiceDomain[];
}

export const SERVICE_DOMAIN_CONFIGS: Record<ServiceDomain, { name: string; description: string; serviceCount: number }> = {
  ai: { name: 'AI服务', description: 'AI对话、智能路由、专家系统', serviceCount: 11 },
  voice: { name: '语音服务', description: '语音识别、合成、实时语音', serviceCount: 6 },
  vision: { name: '视觉服务', description: '屏幕分析、场景识别、文档解码', serviceCount: 5 },
  memory: { name: '记忆服务', description: '情感记忆、梦境、关系图谱', serviceCount: 5 },
  device: { name: '设备服务', description: 'Z3设备、边缘计算、移动端', serviceCount: 5 },
  knowledge: { name: '知识服务', description: '知识库、RAG、技能学习', serviceCount: 4 },
  project: { name: '项目管理', description: '项目、战报、策略、商机', serviceCount: 4 },
  system: { name: '系统服务', description: '邮件、日历、任务、通知', serviceCount: 5 },
  security: { name: '安全服务', description: '认证、安全审计、隐私保护', serviceCount: 5 },
  platform: { name: '平台服务', description: '缓存、限流、监控、日志', serviceCount: 5 },
};
