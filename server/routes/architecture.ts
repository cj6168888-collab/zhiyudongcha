/**
 * ============================================================================
 * 圣宇助手 - 路由层架构 (企业级)
 * ============================================================================
 *
 * 目标: 将108个散乱路由文件整合为10个核心领域路由
 *
 * 架构原则:
 * 1. 领域驱动设计 - 按业务领域划分路由
 * 2. 层级清晰 - 路由前缀体现层级关系
 * 3. 模块化 - 每个领域路由独立管理
 * 4. RESTful规范 - 遵循REST设计原则
 *
 * ============================================================================
 */

/**
 * 路由领域枚举
 */
export enum RouteDomain {
  AUTH = 'auth',
  CHAT = 'chat',
  MEMORY = 'memory',
  VOICE = 'voice',
  VISION = 'vision',
  KNOWLEDGE = 'knowledge',
  DEVICE = 'device',
  SECURITY = 'security',
  MONITOR = 'monitor',
  SYSTEM = 'system'
}

/**
 * 路由领域配置
 */
export interface RouteConfig {
  name: string;
  domain: RouteDomain;
  prefix: string;
  description: string;
  routes: string[];
  middleware?: string[];
}

export const ROUTE_CONFIGS: Record<RouteDomain, RouteConfig> = {
  [RouteDomain.AUTH]: {
    name: '认证授权',
    domain: RouteDomain.AUTH,
    prefix: '/api/auth',
    description: '用户认证、注册登录、权限管理',
    routes: [
      'auth',
      'biometric',
      'biometrics',
      'biometric-ext',
      'secret-vault',
      'tiered-access',
      'access-control'
    ],
    middleware: ['authMiddleware', 'rateLimiter']
  },

  [RouteDomain.CHAT]: {
    name: '对话服务',
    domain: RouteDomain.CHAT,
    prefix: '/api/chat',
    description: 'AI对话、智能问答、上下文管理',
    routes: [
      'chat',
      'conversation',
      'smart-filter',
      'cross-platform-context',
      'ai-dialogue',
      'intent-classification'
    ],
    middleware: ['authMiddleware', 'aiRateLimiter']
  },

  [RouteDomain.MEMORY]: {
    name: '记忆系统',
    domain: RouteDomain.MEMORY,
    prefix: '/api/memory',
    description: '情感记忆、梦境日志、洞察倾听',
    routes: [
      'emotional-memory',
      'dream-logs',
      'insight-listener',
      'memory-recall',
      'dream-analysis'
    ],
    middleware: ['authMiddleware']
  },

  [RouteDomain.VOICE]: {
    name: '语音服务',
    domain: RouteDomain.VOICE,
    prefix: '/api/voice',
    description: '语音识别、语音合成、实时语音',
    routes: [
      'voice',
      'voiceprint',
      'whisper',
      'realtime-voice',
      'streaming-tts',
      'interrupt',
      'voice-recognition',
      'speech-synthesis'
    ],
    middleware: ['voiceMiddleware']
  },

  [RouteDomain.VISION]: {
    name: '视觉服务',
    domain: RouteDomain.VISION,
    prefix: '/api/vision',
    description: '人脸识别、场景识别、AR增强现实',
    routes: [
      'ar-hud',
      'ar-inmo',
      'avatar',
      'scene-recognition',
      'face-compare',
      'image-recognition',
      'object-detection'
    ],
    middleware: ['visionMiddleware']
  },

  [RouteDomain.KNOWLEDGE]: {
    name: '知识服务',
    domain: RouteDomain.KNOWLEDGE,
    prefix: '/api/knowledge',
    description: '知识检索、RAG、文档处理',
    routes: [
      'knowledge',
      'scheduler',
      'rag',
      'improved-knowledge',
      'document-decoder',
      'policy-harvester',
      'search',
      'embeddings'
    ],
    middleware: ['cacheMiddleware']
  },

  [RouteDomain.DEVICE]: {
    name: '设备服务',
    domain: RouteDomain.DEVICE,
    prefix: '/api/device',
    description: '设备管理、设备控制、边缘计算',
    routes: [
      'z3-devices',
      'z6-compute',
      'mobile-edge',
      'laptop-devices',
      'device-registry',
      'desktop-executor',
      'device-control',
      'device-status'
    ],
    middleware: ['deviceAuthMiddleware']
  },

  [RouteDomain.SECURITY]: {
    name: '安全服务',
    domain: RouteDomain.SECURITY,
    prefix: '/api/security',
    description: '生物监护、危机干预、安全审计',
    routes: [
      'bio-guardian',
      'crisis-intervention',
      'threat-detector',
      'security-audit',
      'privacy-grading',
      'threat-analysis',
      'emergency-alert'
    ],
    middleware: ['securityMiddleware', 'auditLogger']
  },

  [RouteDomain.MONITOR]: {
    name: '监控服务',
    domain: RouteDomain.MONITOR,
    prefix: '/api/monitor',
    description: '事件监控、任务追踪、系统遥测',
    routes: [
      'event-monitor',
      'telemetry',
      'feedback',
      'monitoring',
      'capability-indexer',
      'task-tracker',
      'metrics',
      'alerts'
    ],
    middleware: ['metricsMiddleware']
  },

  [RouteDomain.SYSTEM]: {
    name: '系统服务',
    domain: RouteDomain.SYSTEM,
    prefix: '/api/system',
    description: '日历邮件、项目管理、报表生成',
    routes: [
      'persons',
      'vault',
      'project',
      'expenses',
      'integrations',
      'email',
      'email-intelligence',
      'calendar-scheduler',
      'battle-report',
      'contract-pipeline',
      'reports',
      'notifications'
    ],
    middleware: []
  }
};

/**
 * 获取所有路由配置
 */
export function getAllRoutes(): RouteConfig[] {
  return Object.values(ROUTE_CONFIGS);
}

/**
 * 获取路由统计
 */
export function getRouteStatistics(): { domain: string; count: number }[] {
  return Object.values(ROUTE_CONFIGS).map(config => ({
    domain: config.name,
    count: config.routes.length
  }));
}

/**
 * 根据路由名获取所属领域
 */
export function getDomainByRoute(routeName: string): RouteDomain | null {
  for (const [domain, config] of Object.entries(ROUTE_CONFIGS)) {
    if (config.routes.includes(routeName)) {
      return domain as RouteDomain;
    }
  }
  return null;
}

/**
 * 获取总路由数
 */
export function getTotalRouteCount(): number {
  return Object.values(ROUTE_CONFIGS).reduce((sum, config) => sum + config.routes.length, 0);
}

/**
 * 获取所有路由前缀
 */
export function getAllPrefixes(): string[] {
  return Object.values(ROUTE_CONFIGS).map(config => config.prefix);
}

import { createServiceLogger } from '../lib/logger';
createServiceLogger('RouteArchitecture').info(`路由层架构已加载: ${Object.keys(ROUTE_CONFIGS).length} 个领域, ${getTotalRouteCount()} 个路由`);

export default {
  ROUTE_CONFIGS,
  getAllRoutes,
  getRouteStatistics,
  getDomainByRoute,
  getTotalRouteCount,
  getAllPrefixes,
  RouteDomain
};
