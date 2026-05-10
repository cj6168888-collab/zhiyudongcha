import type { Express } from "express";
import { type Server, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { sessionMiddleware } from "./index";
import { attachRole } from "./middleware/auth";
import { validateWsToken } from "./routes/auth";
import { handleASRConnection } from "./services/alibaba-asr";
import type { ChatMessage } from "./services/dashscope";
import type { ConnectedUser, RouteContext } from "./routes/types";

import { registerAuthRoutes } from "./routes/auth";
import { registerAvatarRoutes } from "./routes/avatar";
import { registerPersonsRoutes } from "./routes/persons";
import { registerVaultRoutes } from "./routes/vault";
import { registerZ3DevicesRoutes } from "./routes/z3-devices";
import { registerZ6ComputeRoutes } from "./routes/z6-compute";
import { registerVoiceRoutes } from "./routes/voice";
import { registerEmailRoutes } from "./routes/email";
import { registerExpensesRoutes } from "./routes/expenses";
import { registerIntegrationsRoutes } from "./routes/integrations";
import { registerMiscRoutes } from "./routes/misc";
import { registerScreenRoutes } from "./routes/screen";
import { registerHybridAIRoutes } from "./routes/hybrid-ai";
import { registerDeepInsightRoutes, registerChrysalisRoutes } from "./routes/deepinsight";
import { registerEmailIntelligenceRoutes } from "./routes/email-intelligence";
import { registerTaskExtractorRoutes } from "./routes/task-extractor";
import { registerCrossPlatformContextRoutes } from "./routes/cross-platform-context";
import { registerSmartFilterRoutes } from "./routes/smart-filter";
import { mobileEdgeRouter } from "./routes/mobile-edge";
import { laptopDevicesRouter } from "./routes/laptop-devices";
import { registerKnowledgeRoutes } from "./routes/knowledge";
import lifeLoggerRouter from "./routes/life-logger";
import bioGuardianRouter from "./routes/bio-guardian";
import socialStrategyRouter from "./routes/social-strategy";
import nutritionTrackerRouter from "./routes/nutrition-tracker";
import calendarSchedulerRouter from "./routes/calendar-scheduler";
import guardianAngelEnhancedRouter from "./routes/guardian-angel-enhanced";
import actionPowerRouter from "./routes/action-power";
import { registerUnboundRoutes } from "./routes/unbound";
import immuneRouter from "./routes/immune";
import omniArchiveRouter from "./routes/omni-archive";
import tidyingUpRouter from "./routes/tidying-up";
import lastStandRouter from "./routes/last-stand";
import { registerCommandCenterRoutes } from "./routes/command-center";
import capabilityIndexerRouter from "./routes/capability-indexer";
import privacyGradingRouter from "./routes/privacy-grading";
import { wisdomDistributionService } from "./services/wisdom-distribution";
import pluginSystemRouter from "./routes/plugin-system";
import { registerSkillLearnerRoutes } from "./routes/skill-learner";
import { registerInterfaceXRoutes } from "./routes/interface-x";
import { registerScreenAnalyzeRoutes } from "./routes/screen-analyze";
import { registerOracleRoutes } from "./routes/oracle";
import { registerStrategistRoutes } from "./routes/strategist";
import personalityCoreRouter from "./routes/personality-core";
import spiritSingletonRouter from "./routes/spirit-singleton";
import emotionalMemoryRouter from "./routes/emotional-memory";
import z1RoutingRouter from "./routes/z1-routing";
import relationshipGraphRouter from "./routes/relationship-graph";
import dreamLogsRouter from "./routes/dream-logs";
import proactiveCareRouter from "./routes/proactive-care";
import documentDecoderRouter from "./routes/document-decoder";
import sceneRecognitionRouter from "./routes/scene-recognition";

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

function broadcastDataChange(entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: any) {
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(attachRole);

  const context: RouteContext = {
    z3Clients,
    connectedUsers,
    chatHistories,
    broadcastUserList,
    broadcastDataChange,
  };

  registerAuthRoutes(app, storage);
  registerAvatarRoutes(app, storage, context);
  registerPersonsRoutes(app, storage, broadcastDataChange);
  registerVaultRoutes(app, storage, broadcastDataChange);
  registerZ3DevicesRoutes(app, storage, context);
  registerZ6ComputeRoutes(app, storage);
  registerVoiceRoutes(app, storage, context);
  registerEmailRoutes(app, storage);
  registerEmailIntelligenceRoutes(app, storage);
  console.log('[EmailIntelligence] Routes registered at /api/email-intelligence/*');
  registerTaskExtractorRoutes(app, storage);
  console.log('[TaskExtractor] Routes registered at /api/task-extractor/*');
  registerCrossPlatformContextRoutes(app);
  registerSmartFilterRoutes(app);
  console.log('[ProjectSynergy] Cross-platform context and smart filter routes registered at /api/synergy/*');
  registerExpensesRoutes(app, storage);
  registerIntegrationsRoutes(app, storage);
  registerMiscRoutes(app, storage, context);
  registerHybridAIRoutes(app, storage);
  registerScreenRoutes(app, storage, context);
  registerDeepInsightRoutes(app, storage);
  registerChrysalisRoutes(app);
  registerKnowledgeRoutes(app);
  registerScreenAnalyzeRoutes(app);
  registerOracleRoutes(app);
  registerStrategistRoutes(app);
  console.log('[Strategist] 策略家协议 routes registered at /api/strategist/*');
  
  // 移动边缘AI路由
  app.use('/api/mobile', mobileEdgeRouter);
  console.log('[MobileEdge] Routes registered at /api/mobile/*');

  // 笔记本设备管理路由
  app.use('/api/laptop', laptopDevicesRouter);
  console.log('[LaptopDevices] Routes registered at /api/laptop/*');

  // 生活日志路由 (Project Guardian Angel)
  app.use('/api/life-logger', lifeLoggerRouter);
  console.log('[LifeLogger] Routes registered at /api/life-logger/*');

  // Bio-Guardian生物守护者路由 (Project Guardian Angel)
  app.use('/api/bio-guardian', bioGuardianRouter);
  console.log('[BioGuardian] Routes registered at /api/bio-guardian/*');

  // Social Strategy社交策略路由 (Project Guardian Angel)
  app.use('/api/social-strategy', socialStrategyRouter);
  console.log('[SocialStrategy] Routes registered at /api/social-strategy/*');

  // Nutrition Tracker营养追踪路由 (Project Guardian Angel)
  app.use('/api/nutrition', nutritionTrackerRouter);
  console.log('[NutritionTracker] Routes registered at /api/nutrition/*');

  // Calendar Scheduler日程调度路由 (Project Guardian Angel)
  app.use('/api/calendar', calendarSchedulerRouter);
  console.log('[CalendarScheduler] Routes registered at /api/calendar/*');

  // Guardian Angel Enhanced Routes (通话情绪 + 地点规律)
  app.use('/api/guardian', guardianAngelEnhancedRouter);
  app.use('/api/action-power', actionPowerRouter);
  registerUnboundRoutes(app, storage, context);
  console.log('[ActionPower] Routes registered at /api/action-power/*');
  console.log('[GuardianAngel] Enhanced routes registered at /api/guardian/*');
  console.log('[Unbound] 解缚协议 routes registered at /api/unbound/*');

  // Immune System免疫系统路由 (Project Immune System)
  app.use('/api/immune', immuneRouter);
  console.log('[ImmuneSystem] Routes registered at /api/immune/*');

  // Omni-Archive全域归档路由 (Project Omni-Archive)
  app.use('/api/omni-archive', omniArchiveRouter);
  console.log('[OmniArchive] Routes registered at /api/omni-archive/*');

  // Tidying Up断舍离协议路由 (Project Tidying Up)
  app.use('/api/tidying-up', tidyingUpRouter);
  console.log('[TidyingUp] Routes registered at /api/tidying-up/*');

  // Last Stand最后防线协议路由 (Project Meltdown & Homeward)
  app.use('/api/last-stand', lastStandRouter);
  console.log('[LastStand] Routes registered at /api/last-stand/*');

  // Command Center战情室路由
  registerCommandCenterRoutes(app);
  console.log('[CommandCenter] Routes registered at /api/command-center/*');

  // Capability Indexer团队能力索引路由
  app.use('/api/capability', capabilityIndexerRouter);
  console.log('[CapabilityIndexer] Routes registered at /api/capability/*');

  // Privacy Grading动态隐私分级路由
  app.use('/api/command-center/privacy', privacyGradingRouter);
  console.log('[PrivacyGrading] Routes registered at /api/command-center/privacy/*');

  // Plugin System热更新插件系统路由 (Project Chrysalis)
  app.use('/api/plugins', pluginSystemRouter);
  console.log('[PluginSystem] Routes registered at /api/plugins/*');

  // Skill Learner技能学习系统
  registerSkillLearnerRoutes(app);

  // Interface-X透明驾驶舱
  registerInterfaceXRoutes(app);

  // Personality Core性格引擎路由 (灵魂种子、人格切换、诚实协议)
  app.use('/api/personality', personalityCoreRouter);
  console.log('[PersonalityCore] Routes registered at /api/personality/*');

  // Spirit Singleton灵魂单例协议路由 (跨设备唯一存在)
  app.use('/api/spirit', spiritSingletonRouter);
  app.use('/api/memory', emotionalMemoryRouter);
  console.log('[SpiritSingleton] Routes registered at /api/spirit/*');

  // Z1 Protocol路由管理 (Phase 1.2 敏感检测+日志)
  app.use('/api/z1-routing', z1RoutingRouter);
  console.log('[Z1Routing] Routes registered at /api/z1-routing/*');

  // Phase 2.4: 关系图谱引擎
  app.use('/api/relationships', relationshipGraphRouter);
  console.log('[RelationshipGraph] Routes registered at /api/relationships/*');

  // Phase 3.1: 梦境系统完善
  app.use('/api/dreams', dreamLogsRouter);
  app.use('/api/care', proactiveCareRouter);
  app.use('/api/documents', documentDecoderRouter);
  app.use('/api/scene', sceneRecognitionRouter);
  console.log('[DreamLogs] Routes registered at /api/dreams/*');
  console.log('[DocumentDecoder] Routes registered at /api/documents/*');
  console.log('[SceneRecognition] Routes registered at /api/scene/*');

  // 初始化WisdomDistribution的Z3客户端连接
  wisdomDistributionService.setZ3ClientsSet(z3Clients);
  wisdomDistributionService.setConnectedUsersRef(connectedUsers);
  console.log('[WisdomDistribution] Z3 clients integrated for real-time sync');

  const wss = new WebSocketServer({ noServer: true });
  const wsSessionMap = new WeakMap<WebSocket, { authenticated: boolean; role: 'MASTER' | 'GUEST'; sessionRole?: 'MASTER' | 'GUEST' }>();

  wss.on("connection", (ws, request: IncomingMessage & { session?: { userRole?: 'MASTER' | 'GUEST' }; wsAuthFromUrl?: 'MASTER' | null }) => {
    console.log("[Z3] New WebSocket client connected");
    z3Clients.add(ws);
    
    const sessionRole = request.session?.userRole;
    const urlAuthRole = request.wsAuthFromUrl;
    const effectiveRole = urlAuthRole || sessionRole;
    const isAuthenticated = effectiveRole === 'MASTER';
    wsSessionMap.set(ws, { authenticated: isAuthenticated, role: isAuthenticated ? 'MASTER' : 'GUEST', sessionRole: effectiveRole });
    console.log(`[Z3] Session verified: sessionRole=${sessionRole}, urlAuth=${urlAuthRole}, authenticated=${isAuthenticated}`);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "USER_JOIN") {
          const wsSession = wsSessionMap.get(ws);
          const verifiedRole = (wsSession?.authenticated && wsSession?.sessionRole === 'MASTER' && data.role === 'MASTER') ? 'MASTER' : 'GUEST';
          
          const user: ConnectedUser = {
            ws,
            userId: data.userId || `user_${Date.now()}`,
            username: data.username || '匿名用户',
            deviceId: data.deviceId,
            role: verifiedRole,
            deviceType: data.deviceType || 'unknown',
            connectedAt: Date.now(),
            lastActivity: Date.now(),
          };
          connectedUsers.set(ws, user);
          wsSessionMap.set(ws, { authenticated: wsSession?.authenticated || false, role: verifiedRole, sessionRole: wsSession?.sessionRole });
          console.log(`[Z3] User joined: ${user.username} (${user.role}) [session verified: ${wsSession?.sessionRole}]`);
          
          z3Clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'USER_JOINED',
                user: { userId: user.userId, username: user.username, role: user.role, deviceType: user.deviceType },
                timestamp: Date.now(),
              }));
            }
          });
          
          broadcastUserList();
          return;
        }
        
        const currentUser = connectedUsers.get(ws);
        if (currentUser) {
          currentUser.lastActivity = Date.now();
        }
        
        const wsSession = wsSessionMap.get(ws);
        const isMasterVerified = wsSession?.sessionRole === 'MASTER' && wsSession?.authenticated;
        
        const MASTER_ONLY_ACTIONS = ['SYNC_STATE', 'VISUAL_EFFECT', 'GHOSTING_INIT'];
        if (MASTER_ONLY_ACTIONS.includes(data.type) && !isMasterVerified) {
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: 'UNAUTHORIZED',
            message: '此操作需要MASTER权限',
            requestedAction: data.type,
            timestamp: Date.now(),
          }));
          console.log(`[Z3] Rejected ${data.type} from unauthenticated client`);
          return;
        }
        
        if (data.type === "SYNC_STATE" || data.type === "VISUAL_EFFECT") {
          z3Clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }

        if (data.type === "GHOSTING_INIT") {
          z3Clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "GHOSTING_EVENT",
                from: data.from,
                to: data.to,
                timestamp: Date.now(),
              }));
            }
          });
        }
        
        if (data.type === "CHAT_MESSAGE") {
          const sender = connectedUsers.get(ws);
          z3Clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'CHAT_MESSAGE',
                userId: sender?.userId,
                username: sender?.username,
                message: data.message,
                timestamp: Date.now(),
              }));
            }
          });
        }
      } catch (e) {
        console.error("[Z3] WebSocket message error:", e);
      }
    });

    ws.on("close", () => {
      const user = connectedUsers.get(ws);
      if (user) {
        console.log(`[Z3] User left: ${user.username}`);
        z3Clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'USER_LEFT',
              userId: user.userId,
              username: user.username,
              timestamp: Date.now(),
            }));
          }
        });
        connectedUsers.delete(ws);
      }
      z3Clients.delete(ws);
      broadcastUserList();
    });

    ws.on("error", (error) => {
      console.error("[Z3] WebSocket error:", error);
      const user = connectedUsers.get(ws);
      if (user) {
        connectedUsers.delete(ws);
      }
      z3Clients.delete(ws);
      broadcastUserList();
    });

    ws.send(JSON.stringify({
      type: "CONNECTED",
      message: "Z3 Spirit Core WebSocket active",
      timestamp: Date.now(),
      onlineCount: z3Clients.size,
    }));
  });

  const asrWss = new WebSocketServer({ noServer: true });
  
  asrWss.on("connection", (ws) => {
    console.log("[ASR] New WebSocket client connected");
    handleASRConnection(ws);
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    const pathname = url.pathname;
    
    const tokenParam = url.searchParams.get('token');
    const tokenRole = tokenParam ? validateWsToken(tokenParam) : null;
    
    (request as any).wsAuthFromUrl = tokenRole;
    
    const mockRes = {
      setHeader: () => mockRes,
      end: () => {},
    } as any;
    
    sessionMiddleware(request as any, mockRes, () => {
      if (pathname === '/ws/z3') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else if (pathname === '/ws/asr') {
        asrWss.handleUpgrade(request, socket, head, (ws) => {
          asrWss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  });

  return httpServer;
}
