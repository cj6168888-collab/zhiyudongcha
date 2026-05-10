/**
 * 路由领域分组架构
 *
 * 将111个路由文件按业务领域分组
 *
 * 领域分组:
 * 1. auth      - 认证授权
 * 2. user      - 用户管理
 * 3. ai        - AI对话服务
 * 4. voice     - 语音服务
 * 5. vision    - 视觉服务
 * 6. device    - 设备管理
 * 7. knowledge - 知识服务
 * 8. project   - 项目管理
 * 9. system    - 系统功能
 * 10. monitor  - 监控运维
 */

export const ROUTE_GROUPS = {
  auth: [
    'auth',
    'biometric',
    'secret-vault',
  ],

  user: [
    'persons',
    'user-settings',
    'voiceprint',
    'psych-profiles',
  ],

  ai: [
    'smart-filter',
    'hybrid-ai',
    'cross-platform-context',
    'z1-routing',
    'function-calling',
    'expert-orchestrator',
  ],

  voice: [
    'voice',
    'voice-commander',
    'whisper',
    'streaming-tts',
    'realtime-voice',
    'interrupt',
  ],

  vision: [
    'screen',
    'screen-analyze',
    'scene-recognition',
    'ar-inmo',
    'screen-piercer',
  ],

  device: [
    'z3-devices',
    'z6-compute',
    'mobile-edge',
    'laptop-devices',
  ],

  knowledge: [
    'knowledge',
    'rag-knowledge',
    'document-decoder',
    'skill-learner',
  ],

  project: [
    'projects',
    'insight-listener',
    'deepinsight',
    'battle-report',
    'strategy',
  ],

  system: [
    'email',
    'email-intelligence',
    'expenses',
    'integrations',
    'scheduler',
    'calendar-scheduler',
    'task-extractor',
    'omni-archive',
    'tidying-up',
    'unbound',
  ],

  monitor: [
    'health-check',
    'event-monitor',
    'telemetry',
    'task-tracker',
    'ws-manager',
    'capability-indexer',
    'tech-hunter',
    'navigator-core',
  ],

  memory: [
    'emotional-memory',
    'dream-logs',
    'spirit-singleton',
    'personality-core',
    'relationship-graph',
  ],

  security: [
    'bio-guardian',
    'guardian-angel-enhanced',
    'social-strategy',
    'nutrition-tracker',
    'proactive-care',
    'privacy-grading',
    'security-audit',
    'offline-sync',
    'mcp-protocol',
    'immune',
  ],

  misc: [
    'misc',
    'oracle',
    'last-stand',
    'plugin-system',
    'interface-x',
    'data-lineage',
    'mcts-engine',
  ],
} as const;

export type RouteDomain = keyof typeof ROUTE_GROUPS;

export function getRouteGroup(routeName: string): RouteDomain | null {
  for (const [group, routes] of Object.entries(ROUTE_GROUPS)) {
    if ((routes as readonly string[]).includes(routeName)) {
      return group as RouteDomain;
    }
  }
  return null;
}

export function getRoutesByGroup(group: RouteDomain): readonly string[] {
  return ROUTE_GROUPS[group] || [];
}

export function getAllRouteGroups(): RouteDomain[] {
  return Object.keys(ROUTE_GROUPS) as RouteDomain[];
}
