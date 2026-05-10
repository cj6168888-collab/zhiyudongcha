/**
 * 服务聚合器模块
 *
 * 本目录提供服务的统一聚合入口
 * 实际服务逻辑分布在 services/ 目录
 *
 * 使用方式:
 * import { aiServiceAggregator } from './services/aggregators/ai-service-aggregator';
 */

export const serviceGroups = {
  ai: ['ai-conversation-service', 'aiTools', 'avatar-tools'],
  auth: ['biometric-auth', 'secret-vault', 'api-key-resolver'],
  conversation: ['smart-conversation', 'conversation-manager', 'intent-mapper'],
  memory: ['emotional-memory', 'spirit-singleton', 'vector-memory'],
  voice: ['alibaba-asr', 'azure-tts', 'streaming-tts'],
  vision: ['avatar-recognition', 'contact-recognition', 'scene-recognition'],
  device: ['device-manager', 'z3-device', 'mobile-edge'],
  knowledge: ['knowledge-scheduler', 'improved-knowledge-search', 'rag-engine'],
  monitor: ['proactive-event-monitor', 'task-execution-tracker', 'telemetry'],
  system: ['calendar-scheduler', 'expense-manager', 'email-service']
} as const;

import { createServiceLogger } from '../../lib/logger';
createServiceLogger('Aggregators').info(`服务聚合器已加载: ${Object.keys(serviceGroups).length} 个服务组`);
