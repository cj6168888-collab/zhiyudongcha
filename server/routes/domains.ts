/**
 * 领域路由聚合器
 * 
 * 按业务领域聚合路由，提供统一的路由注册入口
 * 
 * 使用方式:
 * import { authRoutes, aiRoutes, deviceRoutes } from './routes/domains';
 * 
 * authRoutes.register(app, options);
 * aiRoutes.register(app, options);
 */

import type { Express } from 'express';
import type { Server } from 'http';
import type { RouteContext } from './types';
import type { IStorage } from '../storage';

export interface DomainRoutesConfig {
  prefix: string;
  description: string;
  routes: string[];
}

export interface DomainRoutes {
  register(app: Express, config: { storage: IStorage; context?: RouteContext }): void;
  getConfig(): DomainRoutesConfig;
}

export { ROUTE_GROUPS, getRouteGroup, getRoutesByGroup, getAllRouteGroups } from './route-groups';

export const ROUTE_DOMAIN_CONFIGS: Record<string, DomainRoutesConfig> = {
  auth: {
    prefix: '/api/auth',
    description: '认证授权 - 登录注册、权限管理',
    routes: ['auth', 'biometric', 'secret-vault'],
  },
  user: {
    prefix: '/api/user',
    description: '用户管理 - 用户资料、声纹、关系',
    routes: ['persons', 'user-settings', 'voiceprint', 'psych-profiles'],
  },
  ai: {
    prefix: '/api/ai',
    description: 'AI对话 - 智能对话、上下文、路由',
    routes: ['smart-filter', 'hybrid-ai', 'cross-platform-context', 'z1-routing', 'function-calling', 'expert-orchestrator'],
  },
  voice: {
    prefix: '/api/voice',
    description: '语音服务 - 语音识别、合成、实时语音',
    routes: ['voice', 'voice-commander', 'whisper', 'streaming-tts', 'realtime-voice', 'interrupt'],
  },
  vision: {
    prefix: '/api/vision',
    description: '视觉服务 - 屏幕分析、场景识别、AR',
    routes: ['screen', 'screen-analyze', 'scene-recognition', 'ar-inmo', 'screen-piercer'],
  },
  device: {
    prefix: '/api/device',
    description: '设备管理 - Z3设备、边缘计算、移动端',
    routes: ['z3-devices', 'z6-compute', 'mobile-edge', 'laptop-devices'],
  },
  knowledge: {
    prefix: '/api/knowledge',
    description: '知识服务 - RAG、文档、知识库',
    routes: ['knowledge', 'rag-knowledge', 'document-decoder', 'skill-learner'],
  },
  project: {
    prefix: '/api/project',
    description: '项目管理 - 项目、洞察、策略',
    routes: ['projects', 'insight-listener', 'deepinsight', 'battle-report', 'strategy'],
  },
  system: {
    prefix: '/api/system',
    description: '系统功能 - 邮件、日历、任务、归档',
    routes: ['email', 'email-intelligence', 'expenses', 'integrations', 'scheduler', 'calendar-scheduler', 'task-extractor', 'omni-archive', 'tidying-up', 'unbound'],
  },
  monitor: {
    prefix: '/api/monitor',
    description: '监控运维 - 健康检查、事件、遥测、任务追踪',
    routes: ['health-check', 'event-monitor', 'telemetry', 'task-tracker', 'ws-manager', 'capability-indexer', 'tech-hunter', 'swarm-manager'],
  },
  memory: {
    prefix: '/api/memory',
    description: '记忆系统 - 情感记忆、梦境、人格',
    routes: ['emotional-memory', 'dream-logs', 'spirit-singleton', 'personality-core', 'relationship-graph'],
  },
  security: {
    prefix: '/api/security',
    description: '安全服务 - 生物守护、隐私、免疫系统',
    routes: ['bio-guardian', 'guardian-angel-enhanced', 'social-strategy', 'nutrition-tracker', 'proactive-care', 'privacy-grading', 'security-audit', 'offline-sync', 'mcp-protocol', 'immune'],
  },
  misc: {
    prefix: '/api/misc',
    description: '其他功能 - 杂项、插件、Oracle',
    routes: ['misc', 'oracle', 'last-stand', 'plugin-system', 'interface-x', 'data-lineage', 'mcts-engine'],
  },
};

export function getAllDomainRoutes(): DomainRoutesConfig[] {
  return Object.values(ROUTE_DOMAIN_CONFIGS);
}

export function getDomainByRoute(routeName: string): string | null {
  for (const [domain, config] of Object.entries(ROUTE_DOMAIN_CONFIGS)) {
    if (config.routes.includes(routeName)) {
      return domain;
    }
  }
  return null;
}
