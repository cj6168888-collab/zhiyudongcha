/**
 * ============================================================================
 *     🚀 路由分组系统
 * ============================================================================
 *
 * 路由按功能域分组:
 *
 * 认证域 (auth):
 *   - auth.ts, biometric.ts, biometrics.ts, biometric-ext.ts, secret-vault.ts
 *
 * 对话域 (chat):
 *   - chat.ts, conversation.ts, smart-filter.ts
 *
 * 记忆域 (memory):
 *   - emotional-memory.ts, dream-logs.ts, insight-listener.ts
 *
 * 语音域 (voice):
 *   - voice.ts, voiceprint.ts, whisper.ts, realtime-voice.ts, streaming-tts.ts
 *
 * 视觉域 (vision):
 *   - ar-hud.ts, ar-inmo.ts, avatar.ts, scene-recognition.ts
 *
 * 知识域 (knowledge):
 *   - knowledge.ts, scheduler.ts, rag.ts, improved-knowledge.ts
 *
 * 设备域 (device):
 *   - z3-devices.ts, z6-compute.ts, mobile-edge.ts, laptop-devices.ts
 *
 * 安全域 (security):
 *   - bio-guardian.ts, crisis-intervention.ts, threat-detector.ts, security-audit.ts
 *
 * 监控域 (monitor):
 *   - event-monitor.ts, telemetry.ts, feedback.ts, monitoring.ts
 *
 * 系统域 (system):
 *   - persons.ts, vault.ts, project.ts, expenses.ts, integrations.ts, etc.
 *
 * ============================================================================
 *
 * 使用方式:
 * import { registerAuthRoutes } from './routes/auth';
 * import { registerChatRoutes } from './routes/chat';
 *
 * ============================================================================
 */

import { createServiceLogger } from '../../lib/logger';
const log = createServiceLogger('RouteGroups');

export const routeGroups = {
  auth: ['auth', 'biometric', 'biometrics', 'biometric-ext', 'secret-vault'],
  chat: ['chat', 'conversation', 'smart-filter'],
  memory: ['emotional-memory', 'dream-logs', 'insight-listener'],
  voice: ['voice', 'voiceprint', 'whisper', 'realtime-voice', 'streaming-tts'],
  vision: ['ar-hud', 'ar-inmo', 'avatar', 'scene-recognition'],
  knowledge: ['knowledge', 'scheduler', 'rag', 'improved-knowledge'],
  device: ['z3-devices', 'z6-compute', 'mobile-edge', 'laptop-devices'],
  security: ['bio-guardian', 'crisis-intervention', 'threat-detector', 'security-audit'],
  monitor: ['event-monitor', 'telemetry', 'feedback', 'monitoring'],
  system: ['persons', 'vault', 'project', 'expenses', 'integrations', 'email', 'calendar']
} as const;

log.info(`路由分组系统已加载: 10 个功能域`);
