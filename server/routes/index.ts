// [DEPRECATED] 此文件不是当前活跃入口，不被 server/index.ts 调用 — 见 ADR-0005
// 当前活跃入口：server/routes.ts
/**
 * 路由聚合入口
 *
 * 聚合所有领域路由，提供统一的路由注册
 * 实际路由注册在 server/routes.ts 中完成
 *
 * 使用方式:
 * import { registerAllRoutes } from './routes';
 */

import type { Express } from "express";
import type { Server } from "http";
import { WebSocket } from "ws";
import type { ChatMessage } from "../services/dashscope";
import type { ConnectedUser, RouteContext } from "./types";
import { storageAdapter as storage } from "../storage/adapter";
import { attachRole } from "../middleware/auth";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('Routes');

const z3Clients: Set<WebSocket> = new Set();
const connectedUsers: Map<WebSocket, ConnectedUser> = new Map();
const chatHistories: Map<string, ChatMessage[]> = new Map();

function broadcastUserList() {
  const userList = Array.from(connectedUsers.values()).map(u => ({
    userId: u.userId,
    username: u.username,
    role: u.role,
    deviceType: u.deviceType,
    connectedAt: u.connectedAt,
  }));

  const message = JSON.stringify({
    type: 'USER_LIST_UPDATE',
    users: userList,
    count: userList.length,
    timestamp: Date.now(),
  });

  z3Clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastDataChange(entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) {
  const message = JSON.stringify({
    type: 'DATA_CHANGE',
    entity,
    action,
    data,
    timestamp: Date.now(),
  });

  z3Clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export type { RouteContext, ConnectedUser };
export { z3Clients, connectedUsers, chatHistories, broadcastUserList, broadcastDataChange };

// Import all route registrars - only core routes that use function calls
import { registerAuthRoutes } from "./auth";
import { registerAvatarRoutes } from "./avatar";
import { registerPersonsRoutes } from "./persons";
import { registerVaultRoutes } from "./vault";
import { registerZ3DevicesRoutes } from "./z3-devices";
import { registerZ6ComputeRoutes } from "./z6-compute";
import { registerVoiceRoutes } from "./voice";
import { registerEmailRoutes } from "./email";
import { registerExpensesRoutes } from "./expenses";
import { registerIntegrationsRoutes } from "./integrations";
import { registerMiscRoutes } from "./misc";
import { registerScreenRoutes } from "./screen";
import { registerHybridAIRoutes } from "./hybrid-ai";
import { registerDeepInsightRoutes, registerChrysalisRoutes } from "./deepinsight";
import { registerEmailIntelligenceRoutes } from "./email-intelligence";
import { registerTaskExtractorRoutes } from "./task-extractor";
import { registerCrossPlatformContextRoutes } from "./cross-platform-context";
import { registerSmartFilterRoutes } from "./smart-filter";
import { registerProjectRoutes } from "./projects";
import { registerScreenAnalyzeRoutes } from "./screen-analyze";
import { registerOracleRoutes } from "./oracle";
import { registerStrategistRoutes } from "./strategist";
import { registerKnowledgeRoutes } from "./knowledge";
import { registerCommandCenterRoutes } from "./command-center";
import { registerSkillLearnerRoutes } from "./skill-learner";
import { registerInterfaceXRoutes } from "./interface-x";
import { registerInsightListenerRoutes } from "./insight-listener";
import { registerConversationRoutes } from "./conversation";
import { registerRealtimeVoiceRoutes } from "./realtime-voice";
import { registerStreamingTTSRoutes } from "./streaming-tts";
import { registerInterruptRoutes } from "./interrupt";
import { registerRAGRoutes } from "./rag-knowledge";
import { registerFunctionCallingRoutes } from "./function-calling";
import { registerMCPRoutes } from "./mcp-protocol";
import { registerMCTSRoutes } from "./mcts-engine";
import { registerTechHunterRoutes } from "./tech-hunter";
import { registerSwarmRoutes } from "./swarm-manager";
import { registerVoiceCommanderRoutes } from "./voice-commander";
import { registerWhisperRoutes } from "./whisper";
import { registerScreenPiercerRoutes } from "./screen-piercer";
import { registerDataLineageRoutes } from "./data-lineage";
import { Router } from 'express'
import { registerBattleReportRoutes } from './battle-report'
import { registerWSManagerRoutes } from './ws-manager'
import { registerUnboundRoutes } from './unbound'

import arInmoRouter, { setBroadcastFunction as setArInmoBroadcast } from './ar-inmo'
import mockOpRouter from './mock-op'
import biometricRouter from './biometric'
import schedulerRoutesRouter from './scheduler-routes'
import mobileEdgeRouter from './mobile-edge'
import laptopDevicesRouter from './laptop-devices'
import lifeLoggerRouter from './life-logger'
import bioGuardianRouter from './bio-guardian'
import socialStrategyRouter from './social-strategy'
import nutritionTrackerRouter from './nutrition-tracker'
import calendarSchedulerRouter from './calendar-scheduler'
import guardianAngelEnhancedRouter from './guardian-angel-enhanced'
import actionPowerRouter from './action-power'
import immuneRouter from './immune'
import omniArchiveRouter from './omni-archive'
import tidyingUpRouter from './tidying-up'
import lastStandRouter from './last-stand'
import capabilityIndexerRouter from './capability-indexer'
import privacyGradingRouter from './privacy-grading'
import pluginSystemRouter from './plugin-system'
import personalityCoreRouter from './personality-core'
import spiritSingletonRouter from './spirit-singleton'
import emotionalMemoryRouter from './emotional-memory'
import z1RoutingRouter from './z1-routing'
import relationshipGraphRouter from './relationship-graph'
import dreamLogsRouter from './dream-logs'
import proactiveCareRouter from './proactive-care'
import documentDecoderRouter from './document-decoder'
import sceneRecognitionRouter from './scene-recognition'
import secretVaultRouter from './secret-vault'
import securityAuditRouter from './security-audit'
import expertOrchestratorRouter from './expert-orchestrator'
import telemetryRouter from './telemetry'
import offlineSyncRouter from './offline-sync'
import syncRouter from './sync'
import healthCheckRouter from './health-check'
import eventMonitorRouter from './event-monitor'
import taskTrackerRouter from './task-tracker'

export async function registerAllRoutes(
  app: Express
): Promise<void> {
  app.use(attachRole);

  const context: RouteContext = {
    z3Clients,
    connectedUsers,
    chatHistories,
    broadcastUserList,
    broadcastDataChange,
  };

  // Core routes
  registerAuthRoutes(app, storage);
  registerAvatarRoutes(app, storage, context);
  registerPersonsRoutes(app, storage, broadcastDataChange);
  registerVaultRoutes(app, storage, broadcastDataChange);
  registerZ3DevicesRoutes(app, storage, context);
  registerZ6ComputeRoutes(app, storage);
  registerVoiceRoutes(app, storage, context);
  registerEmailRoutes(app, storage);
  registerEmailIntelligenceRoutes(app, storage);
  registerTaskExtractorRoutes(app, storage);
  registerCrossPlatformContextRoutes(app);
  registerSmartFilterRoutes(app);
  registerExpensesRoutes(app, storage);
  registerIntegrationsRoutes(app, storage);
  registerMiscRoutes(app, storage, context);
  registerProjectRoutes(app, storage, context);
  registerHybridAIRoutes(app, storage);
  registerScreenRoutes(app, storage, context);
  registerDeepInsightRoutes(app, storage);
  registerChrysalisRoutes(app);
  registerKnowledgeRoutes(app);
  registerScreenAnalyzeRoutes(app);
  registerOracleRoutes(app);
  registerStrategistRoutes(app);

  // Set up broadcast function for AR
  setArInmoBroadcast((deviceId: string, message: unknown) => {
    Array.from(connectedUsers.entries()).forEach(([ws, user]) => {
      if (user.deviceId === deviceId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  });

  // Express routers
  app.use('/api/ar', arInmoRouter);
  app.use('/api/mockop', mockOpRouter);
  app.use('/api/biometric', biometricRouter);
  app.use('/api/scheduler', schedulerRoutesRouter);
  app.use('/api/mobile', mobileEdgeRouter);
  app.use('/api/laptop', laptopDevicesRouter);
  app.use('/api/life-logger', lifeLoggerRouter);
  app.use('/api/bio-guardian', bioGuardianRouter);
  app.use('/api/social-strategy', socialStrategyRouter);
  app.use('/api/nutrition', nutritionTrackerRouter);
  app.use('/api/calendar', calendarSchedulerRouter);
  app.use('/api/guardian', guardianAngelEnhancedRouter);
  app.use('/api/action-power', actionPowerRouter);
  app.use('/api/immune', immuneRouter);
  app.use('/api/omni-archive', omniArchiveRouter);
  app.use('/api/tidying-up', tidyingUpRouter);
  app.use('/api/last-stand', lastStandRouter);
  app.use('/api/capability', capabilityIndexerRouter);
  app.use('/api/plugins', pluginSystemRouter);
  app.use('/api/personality', personalityCoreRouter);
  app.use('/api/spirit', spiritSingletonRouter);
  app.use('/api/memory', emotionalMemoryRouter);
  app.use('/api/z1-routing', z1RoutingRouter);
  app.use('/api/relationships', relationshipGraphRouter);
  app.use('/api/dreams', dreamLogsRouter);
  app.use('/api/proactive-care', proactiveCareRouter);
  app.use('/api/document-decoder', documentDecoderRouter);
  app.use('/api/scene-recognition', sceneRecognitionRouter);
  app.use('/api/secret-vault', secretVaultRouter);
  app.use('/api/security-audit', securityAuditRouter);
  app.use('/api/expert-orchestrator', expertOrchestratorRouter);
  app.use('/api/telemetry', telemetryRouter);
  app.use('/api/offline-sync', offlineSyncRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/health', healthCheckRouter);
  app.use('/api/event-monitor', eventMonitorRouter);
  app.use('/api/task-tracker', taskTrackerRouter);

  // Additional route registrations
  registerUnboundRoutes(app, storage, context);
  registerCommandCenterRoutes(app);
  registerSkillLearnerRoutes(app);
  registerInterfaceXRoutes(app);
  registerInsightListenerRoutes(app);
  registerConversationRoutes(app);
  registerRealtimeVoiceRoutes(app);
  registerStreamingTTSRoutes(app);
  registerInterruptRoutes(app);
  registerRAGRoutes(app);
  registerFunctionCallingRoutes(app);
  registerMCPRoutes(app);
  registerMCTSRoutes(app);
  registerTechHunterRoutes(app);
  registerSwarmRoutes(app);
  registerVoiceCommanderRoutes(app);
  registerWhisperRoutes(app);
  registerScreenPiercerRoutes(app);
  registerDataLineageRoutes(app);
  registerBattleReportRoutes(app);
  registerWSManagerRoutes(app);

  logger.info('All routes registered successfully');
}
