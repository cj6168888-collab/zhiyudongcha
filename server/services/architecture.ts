/**
 * ============================================================================
 * 圣宇助手 - 服务层架构 (企业级)
 * ============================================================================
 * 
 * 目标: 将142个散乱服务文件整合为10个核心领域模块
 * 
 * 架构原则:
 * 1. 单一职责 - 每个领域只负责一个功能域
 * 2. 高内聚低耦合 - 模块内紧耦合，模块间松耦合
 * 3. 清晰边界 - 模块之间通过接口通信
 * 4. 依赖注入 - 使用 IOC 容器管理依赖
 * 
 * ============================================================================
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ServiceArchitecture');

/**
 * 服务领域枚举
 */
export enum ServiceDomain {
  AI = 'ai',
  AUTH = 'auth',
  MEMORY = 'memory',
  VOICE = 'voice',
  VISION = 'vision',
  DEVICE = 'device',
  KNOWLEDGE = 'knowledge',
  SECURITY = 'security',
  MONITOR = 'monitor',
  SYSTEM = 'system'
}

/**
 * 服务领域映射配置
 * 每个领域包含: 领域名称、服务列表、API前缀、描述
 */
export interface DomainConfig {
  name: string;
  domain: ServiceDomain;
  prefix: string;
  description: string;
  services: string[];
}

export const DOMAIN_CONFIGS: Record<ServiceDomain, DomainConfig> = {
  [ServiceDomain.AI]: {
    name: 'AI对话服务',
    domain: ServiceDomain.AI,
    prefix: '/api/ai',
    description: '提供AI对话、智能问答、意图识别等功能',
    services: [
      'ai-conversation-service',
      'ai-conversation-cache',
      'aiTools',
      'smart-conversation',
      'intent-mapper',
      'empathic-dialogue',
      'function-calling',
      'dashscope',
      'dashscope-enhanced',
      'contextGatherer'
    ]
  },
  
  [ServiceDomain.AUTH]: {
    name: '认证授权服务',
    domain: ServiceDomain.AUTH,
    prefix: '/api/auth',
    description: '提供用户认证、权限管理、生物识别等功能',
    services: [
      'biometric-auth',
      'secret-vault',
      'api-key-resolver',
      'tiered-access',
      'access-control'
    ]
  },
  
  [ServiceDomain.MEMORY]: {
    name: '记忆服务',
    domain: ServiceDomain.MEMORY,
    prefix: '/api/memory',
    description: '提供情感记忆、梦境分析、洞察倾听等功能',
    services: [
      'emotional-memory',
      'spirit-singleton',
      'vector-memory',
      'dream-service',
      'dream-analyzer',
      'insight-listener',
      'memory-recall'
    ]
  },
  
  [ServiceDomain.VOICE]: {
    name: '语音服务',
    domain: ServiceDomain.VOICE,
    prefix: '/api/voice',
    description: '提供语音识别、语音合成、实时语音等功能',
    services: [
      'alibaba-asr',
      'azure-tts',
      'streaming-tts',
      'voice-commander',
      'voiceprint',
      'whisper-assistant',
      'realtime-voice',
      'interrupt-handler',
      'voice-analysis'
    ]
  },
  
  [ServiceDomain.VISION]: {
    name: '视觉服务',
    domain: ServiceDomain.VISION,
    prefix: '/api/vision',
    description: '提供人脸识别、场景识别、AR等功能',
    services: [
      'avatar-recognition',
      'avatar-tools',
      'avatar-powers',
      'contact-recognition',
      'scene-recognition',
      'face-compare',
      'ar-inmo',
      'ar-hud',
      'image-analysis'
    ]
  },
  
  [ServiceDomain.DEVICE]: {
    name: '设备服务',
    domain: ServiceDomain.DEVICE,
    prefix: '/api/device',
    description: '提供设备管理、设备控制、边缘计算等功能',
    services: [
      'device-manager',
      'device-registry',
      'device-sentry',
      'z3-device',
      'z3-client',
      'mobile-edge',
      'laptop-devices',
      'desktop-executor',
      'device-discovery'
    ]
  },
  
  [ServiceDomain.KNOWLEDGE]: {
    name: '知识服务',
    domain: ServiceDomain.KNOWLEDGE,
    prefix: '/api/knowledge',
    description: '提供知识检索、RAG、文档处理等功能',
    services: [
      'knowledge-scheduler',
      'improved-knowledge-search',
      'rag-engine',
      'document-decoder',
      'document-manager',
      'policy-harvester',
      'knowledge-graph',
      'embedding-service'
    ]
  },
  
  [ServiceDomain.SECURITY]: {
    name: '安全服务',
    domain: ServiceDomain.SECURITY,
    prefix: '/api/security',
    description: '提供生物监护、危机干预、安全审计等功能',
    services: [
      'bio-guardian',
      'crisis-intervention',
      'threat-detector',
      'security-audit',
      'failure-collector',
      'threat-analysis',
      'privacy-protection'
    ]
  },
  
  [ServiceDomain.MONITOR]: {
    name: '监控服务',
    domain: ServiceDomain.MONITOR,
    prefix: '/api/monitor',
    description: '提供事件监控、任务追踪、遥测等功能',
    services: [
      'proactive-event-monitor',
      'task-execution-tracker',
      'telemetry',
      'feedback-logger',
      'capability-indexer',
      'metrics-collector',
      'alert-manager'
    ]
  },
  
  [ServiceDomain.SYSTEM]: {
    name: '系统服务',
    domain: ServiceDomain.SYSTEM,
    prefix: '/api/system',
    description: '提供日历、邮件、报表、项目等系统功能',
    services: [
      'calendar-scheduler',
      'email-service',
      'email-intelligence',
      'expense-manager',
      'project-engine',
      'battle-report',
      'battle-report-generator',
      'contract-pipeline',
      'notification-service',
      'report-generator'
    ]
  }
};

/**
 * 获取所有服务领域
 */
export function getAllDomains(): DomainConfig[] {
  return Object.values(DOMAIN_CONFIGS);
}

/**
 * 获取服务领域统计
 */
export function getDomainStatistics(): { domain: string; count: number }[] {
  return Object.values(DOMAIN_CONFIGS).map(config => ({
    domain: config.name,
    count: config.services.length
  }));
}

/**
 * 根据服务名获取所属领域
 */
export function getDomainByService(serviceName: string): ServiceDomain | null {
  for (const [domain, config] of Object.entries(DOMAIN_CONFIGS)) {
    if (config.services.includes(serviceName)) {
      return domain as ServiceDomain;
    }
  }
  return null;
}

/**
 * 获取总服务数
 */
export function getTotalServiceCount(): number {
  return Object.values(DOMAIN_CONFIGS).reduce((sum, config) => sum + config.services.length, 0);
}

// 初始化日志
logger.info('服务层架构已初始化', {
  domains: Object.keys(DOMAIN_CONFIGS).length,
  totalServices: getTotalServiceCount()
});

export default {
  DOMAIN_CONFIGS,
  getAllDomains,
  getDomainStatistics,
  getDomainByService,
  getTotalServiceCount,
  ServiceDomain
};
