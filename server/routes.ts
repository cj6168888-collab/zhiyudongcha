// [ACTIVE ENTRY] 当前唯一活跃路由入口 — 见 ADR-0005；server/routes/index.ts 非活跃
/**
 * 吉麟洞察 32.0 - 核心路由总线 (全功能贯通版)
 */
import type { Express } from "express";
import { createServiceLogger } from "./lib/logger";
const routeLogger = createServiceLogger('Routes');
import { type Server } from "http";
import { storageAdapter } from "./storage/adapter";
import { webSocketManager } from './websocket';
import { attachRole } from "./middleware/auth";
import { attachAuthzContext } from "./middleware/authorization";
import { registerAuthzRoutes } from "./routes/authz";

// 导入全量核心业务注册器
import { registerAuthRoutes } from "./routes/auth";
import { registerVaultRoutes } from "./routes/vault";
import { registerProjectRoutes } from "./routes/projects";
import { registerPersonsRoutes } from "./routes/persons";
import { registerHPRoutes } from "./routes/hp";
import { registerNavigatorRoutes } from "./routes/navigator-core";
import { registerBattleReportRoutes } from "./routes/battle-report";
import businessRouter from "./routes/business.routes";
import { remoteControlRouter } from "./routes/remote-control";
import { taskRouter } from "./routes/tasks";
import { alertRouter } from "./routes/alerts";
import { initRealtimeVoiceWebSocket, registerRealtimeVoiceRoutes } from "./routes/realtime-voice";
import { initDeviceWebSocket } from "./services/devices/NavigatorDeviceRuntime";
import chrysalisRouter from "./routes/chrysalis";
import agentRouter from "./routes/agent";
import agentNLRouter from "./routes/agent-nl";
import proactiveRouter from "./routes/proactive";
import recommendRouter from "./routes/recommend";
import meetingRouter from "./routes/meeting";
import smartAssistantRouter from "./routes/smart-assistant";
import hybridAssistantRouter from "./routes/hybrid-assistant";
import expertOrchestratorRouter from "./routes/expert-orchestrator";
import { registerExpertRoutes } from "./routes/expert";
import crossDeviceRouter from "./routes/cross-device";
import deviceCommandRouter from "./routes/device-command";
import pcAgentRouter from "./routes/pc-agent";
import knowledgeRouter from "./routes/knowledge";
import cozeRouter from "./routes/coze";
import modelRouter from "./routes/model.routes";
import telemetryRouter from "./routes/telemetry";
import { conversationRouter, conversationInboxRouter, conversationCandidateRouter } from "./routes/conversations";
import { deviceBindingsRouter } from "./routes/device-bindings";
import { providersRouter } from "./routes/providers";
import { screenAwarenessRouter } from "./routes/screen-awareness";
import { dreamReviewRouter } from "./routes/dream-review";
import { schedulerService } from "./services/scheduler";
import { taskOrchestrator } from "./services/task-orchestrator/TaskOrchestrator";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(attachRole);
  app.use(attachAuthzContext);

  // 1. 初始化底层引擎
  webSocketManager.initialize(httpServer);
  const context = webSocketManager.context;
  initRealtimeVoiceWebSocket(httpServer);
  initDeviceWebSocket(httpServer);

  // 启动任务调度引擎（CRON 任务 + 预设后台任务）
  schedulerService.initialize().catch((err) => routeLogger.warn({ err }, 'Scheduler initialize failed'));
  taskOrchestrator.initialize().catch((err) => routeLogger.warn({ err }, 'TaskOrchestrator initialize failed'));

  const { remoteControlService } = await import('./services/remote-control');
  remoteControlService.initialize(httpServer);

  // 启动时同步Coze API配置
  try {
    const { userService } = await import('./services/UserService');
    await userService.syncCozeFromSettings();
  } catch (error) {
    routeLogger.warn({ err: error }, 'Failed to sync Coze settings on startup');
  }

  // 2. 注册全量 API (对齐 148 个后端服务)
  registerAuthRoutes(app, storageAdapter);
  registerAuthzRoutes(app);
  registerProjectRoutes(app, storageAdapter, context);
  registerVaultRoutes(app, storageAdapter, context.broadcastDataChange);
  registerPersonsRoutes(app, storageAdapter, context.broadcastDataChange);
  registerHPRoutes(app, { httpServer, connectedUsers: context.connectedUsers, storage: storageAdapter } as any);
  registerNavigatorRoutes(app, storageAdapter, context);
  registerBattleReportRoutes(app, storageAdapter, context);

  // 3. 挂载新增模块 (统一前缀)
  app.use('/api/business', businessRouter);
  app.use('/api/remote', remoteControlRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/alerts', alertRouter);
  app.use('/api/chrysalis', chrysalisRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/agent/nl', agentNLRouter);
  app.use('/api/proactive', proactiveRouter);
  app.use('/api/recommend', recommendRouter);
  app.use('/api/meeting', meetingRouter);
  app.use('/api/assistant', hybridAssistantRouter);
  app.use('/api/expert-orchestrator', expertOrchestratorRouter);
  registerExpertRoutes(app, {
    httpServer,
    connectedUsers: context.connectedUsers,
    storage: storageAdapter,
  });
  app.use('/api/cross-device', crossDeviceRouter);
  app.use('/api/devices', deviceCommandRouter);
  app.use('/api/pc-agent', pcAgentRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/coze', cozeRouter);
  app.use('/api/models', modelRouter);
  app.use('/api/telemetry', telemetryRouter);
  app.use('/api/conversations', conversationRouter);
  app.use('/api/conversation-inbox', conversationInboxRouter);
  app.use('/api/conversation-candidates', conversationCandidateRouter);
  app.use('/api/device-bindings', deviceBindingsRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/screen-awareness', screenAwarenessRouter);
  app.use('/api/dream-review', dreamReviewRouter);
  registerRealtimeVoiceRoutes(app, storageAdapter, context);

  // ESP32 在线状态（供前端轮询）
  app.get('/api/devices/esp32/status', (req, res) => {
    const { navigatorDeviceRuntime } = require('./services/devices/NavigatorDeviceRuntime');
    res.json({
      success: true,
      online: navigatorDeviceRuntime.getOnlineDevices(),
      sessionCount: navigatorDeviceRuntime.getSessionCount(),
    });
  });

  // 核心激活：真实遥测健康接口 (解决硬伤 2)
  app.get('/api/health', async (req, res) => {
    const nodes = Array.from(context.connectedUsers.values());
    let hpBalance = '0.0';
    let databaseStatus: 'ok' | 'degraded' = 'ok';

    try {
      const hp = await storageAdapter.getHPBalance();
      hpBalance = (hp.balance / 10).toFixed(1);
    } catch (error) {
      databaseStatus = 'degraded';
      console.warn('Health check HP query failed:', error);
    }

    res.json({
      success: true,
      hp: hpBalance,
      status: databaseStatus === 'ok' ? 'Active' : 'Degraded',
      database: databaseStatus,
      nodes: nodes.length,
      latency: nodes[0]?.latency || 12,
      load: nodes.length > 5 ? 'MEDIUM' : 'OPTIMAL'
    });
  });

  return httpServer;
}
