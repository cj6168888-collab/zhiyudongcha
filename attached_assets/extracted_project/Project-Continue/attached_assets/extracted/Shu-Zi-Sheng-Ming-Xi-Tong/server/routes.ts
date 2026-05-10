import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  insertPersonSchema,
  insertVaultItemSchema,
  insertShadowMemorySchema,
  insertDownloadTaskSchema,
  insertComputeJobSchema,
  insertDreamLogSchema,
} from "@shared/schema";
import { attachRole, requireMaster, auditAction } from "./middleware/auth";
import { chatWithDashScope, executeAvatarCommand, type ChatMessage } from "./services/dashscope";
import { 
  invokeOraclePower, 
  invokeAegisPower, 
  invokeGnosisPower, 
  invokePrometheusPower,
  getAllPowersStatus,
  recordConversation
} from "./services/avatar-powers";

// Z3 WebSocket Clients Registry with user info
interface ConnectedUser {
  ws: WebSocket;
  userId: string;
  username: string;
  role: 'MASTER' | 'GUEST';
  deviceType: string;
  connectedAt: number;
  lastActivity: number;
}

const z3Clients: Set<WebSocket> = new Set();
const connectedUsers: Map<WebSocket, ConnectedUser> = new Map();

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


const chatHistories: Map<string, ChatMessage[]> = new Map();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(attachRole);

  // ===== Avatar AI Chat Routes =====
  
  app.post("/api/avatar/chat", async (req, res) => {
    try {
      const { message, sessionId = 'default' } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      let history = chatHistories.get(sessionId) || [];
      
      const command = await chatWithDashScope(history, message);
      
      const result = await executeAvatarCommand(command, storage);
      
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: result.message });
      
      recordConversation(message, result.message);
      
      if (history.length > 20) {
        history = history.slice(-20);
      }
      chatHistories.set(sessionId, history);
      
      res.json({
        success: result.success,
        message: result.message,
        command: {
          action: command.action,
          entity: command.entity,
        },
        data: result.data,
      });
    } catch (error) {
      console.error('[Avatar] Chat error:', error);
      res.status(500).json({ 
        success: false,
        message: "抱歉，我遇到了一些问题。请稍后再试。" 
      });
    }
  });

  app.delete("/api/avatar/chat/:sessionId", async (req, res) => {
    chatHistories.delete(req.params.sessionId);
    res.json({ success: true });
  });

  // ===== Avatar Powers API =====
  
  app.get("/api/avatar/powers", async (req, res) => {
    try {
      const status = getAllPowersStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get powers status" });
    }
  });

  app.get("/api/avatar/powers/oracle", async (req, res) => {
    try {
      const insights = await invokeOraclePower();
      res.json({ 
        power: '神谕之力',
        status: 'active',
        insights 
      });
    } catch (error) {
      console.error('[Oracle] Error:', error);
      res.status(500).json({ error: "神谕之力暂时无法启动" });
    }
  });

  app.get("/api/avatar/powers/aegis", async (req, res) => {
    try {
      const status = await invokeAegisPower();
      res.json({ 
        power: '圣盾之力',
        status: 'active',
        ...status 
      });
    } catch (error) {
      console.error('[Aegis] Error:', error);
      res.status(500).json({ error: "圣盾之力暂时无法启动" });
    }
  });

  app.get("/api/avatar/powers/gnosis", async (req, res) => {
    try {
      const memory = invokeGnosisPower();
      res.json({ 
        power: '灵知之力',
        status: 'active',
        ...memory 
      });
    } catch (error) {
      console.error('[Gnosis] Error:', error);
      res.status(500).json({ error: "灵知之力暂时无法启动" });
    }
  });

  app.get("/api/avatar/powers/prometheus", async (req, res) => {
    try {
      const evolution = invokePrometheusPower();
      res.json({ 
        power: '普罗米修斯之力',
        status: 'active',
        ...evolution 
      });
    } catch (error) {
      console.error('[Prometheus] Error:', error);
      res.status(500).json({ error: "普罗米修斯之力暂时无法启动" });
    }
  });

  // ===== Z2: Person (Relationship Matrix) Routes =====
  
  app.get("/api/persons", async (req, res) => {
    try {
      const accessLevel = req.query.accessLevel as string | undefined;
      const persons = await storage.getAllPersons(accessLevel);
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch persons" });
    }
  });

  app.get("/api/persons/:id", async (req, res) => {
    try {
      const person = await storage.getPerson(req.params.id);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch person" });
    }
  });

  app.post("/api/persons", async (req, res) => {
    try {
      const validated = insertPersonSchema.parse(req.body);
      const person = await storage.createPerson(validated);
      broadcastDataChange('person', 'CREATE', { id: person.id, name: person.name });
      res.status(201).json(person);
    } catch (error) {
      res.status(400).json({ error: "Invalid person data", details: error });
    }
  });

  app.patch("/api/persons/:id", async (req, res) => {
    try {
      const person = await storage.updatePerson(req.params.id, req.body);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      broadcastDataChange('person', 'UPDATE', { id: person.id, name: person.name });
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: "Failed to update person" });
    }
  });

  app.delete("/api/persons/:id", async (req, res) => {
    try {
      const success = await storage.deletePerson(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Person not found" });
      }
      broadcastDataChange('person', 'DELETE', { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete person" });
    }
  });

  app.get("/api/persons/search/weakness", async (req, res) => {
    try {
      const keyword = req.query.q as string;
      if (!keyword) {
        return res.status(400).json({ error: "Missing query parameter: q" });
      }
      const persons = await storage.searchPersonsByWeakness(keyword);
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to search persons" });
    }
  });

  app.get("/api/persons/:id/conflicts", async (req, res) => {
    try {
      const conflicts = await storage.findConflictingRelationships(req.params.id);
      res.json(conflicts);
    } catch (error) {
      res.status(500).json({ error: "Failed to find conflicts" });
    }
  });

  // [NEW] Z2: Relationship Insight (博弈素材提取)
  app.get("/api/persons/insight/:name", async (req, res) => {
    try {
      const insight = await storage.getRelationshipInsight(req.params.name);
      if (!insight) {
        return res.status(404).json({ error: "Person not found for insight analysis" });
      }
      res.json(insight);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate relationship insight" });
    }
  });

  // ===== Z2: Vault (Resource Vault) Routes =====

  app.get("/api/vault", async (req, res) => {
    try {
      const zone = req.query.zone as string | undefined;
      const items = await storage.getAllVaultItems(zone);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault items" });
    }
  });

  app.get("/api/vault/:id", async (req, res) => {
    try {
      const item = await storage.getVaultItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Vault item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault item" });
    }
  });

  app.post("/api/vault", async (req, res) => {
    try {
      const validated = insertVaultItemSchema.parse(req.body);
      const item = await storage.createVaultItem(validated);
      broadcastDataChange('vault', 'CREATE', { id: item.id, fileName: item.fileName });
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid vault item data", details: error });
    }
  });

  app.patch("/api/vault/:id", async (req, res) => {
    try {
      const item = await storage.updateVaultItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Vault item not found" });
      }
      broadcastDataChange('vault', 'UPDATE', { id: item.id, fileName: item.fileName });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vault item" });
    }
  });

  app.delete("/api/vault/:id", async (req, res) => {
    try {
      const success = await storage.deleteVaultItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Vault item not found" });
      }
      broadcastDataChange('vault', 'DELETE', { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vault item" });
    }
  });

  app.get("/api/vault/search/semantic", async (req, res) => {
    try {
      const tag = req.query.tag as string;
      if (!tag) {
        return res.status(400).json({ error: "Missing query parameter: tag" });
      }
      const items = await storage.searchVaultBySemanticTag(tag);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to search vault" });
    }
  });

  // [NEW] Z2: Intent-based Search (意图语义调阅)
  app.get("/api/vault/search/intent", async (req, res) => {
    try {
      const intent = req.query.q as string;
      if (!intent) {
        return res.status(400).json({ error: "Missing query parameter: q" });
      }
      const items = await storage.searchVaultByIntent(intent);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to search vault by intent" });
    }
  });

  // [NEW] Z2: Physical Shredding (物理级粉碎) - MASTER ONLY
  app.post("/api/shred", requireMaster, async (req, res) => {
    try {
      const { targetId, table } = req.body;
      
      if (!targetId || !table) {
        return res.status(400).json({ error: "Missing targetId or table parameter" });
      }
      
      if (table !== 'vault' && table !== 'person') {
        return res.status(400).json({ error: "Table must be 'vault' or 'person'" });
      }

      await auditAction('SHRED_INITIATED', req.userRole || 'MASTER', table, targetId, { table }, 'SUCCESS', req);
      
      const result = await storage.permanentShred(targetId, table);
      
      if (result.success) {
        await auditAction('SHRED_COMPLETE', req.userRole || 'MASTER', table, targetId, result, 'SUCCESS', req);
        res.json(result);
      } else {
        await auditAction('SHRED_FAILED', req.userRole || 'MASTER', table, targetId, result, 'FAILED', req);
        res.status(404).json(result);
      }
    } catch (error) {
      await auditAction('SHRED_ERROR', req.userRole || 'MASTER', 'unknown', req.body.targetId, { error: String(error) }, 'FAILED', req);
      res.status(500).json({ error: "Shredding operation failed" });
    }
  });

  // ===== Z2: Shadow Memory Routes =====

  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await storage.getAllMemories();
      res.json(memories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch memories" });
    }
  });

  app.post("/api/memories", async (req, res) => {
    try {
      const validated = insertShadowMemorySchema.parse(req.body);
      const memory = await storage.createMemory(validated);
      res.status(201).json(memory);
    } catch (error) {
      res.status(400).json({ error: "Invalid memory data", details: error });
    }
  });

  // ===== Z3: WebSocket Server for Spirit Core =====
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/z3" });

  wss.on("connection", (ws) => {
    console.log("[Z3] New WebSocket client connected");
    z3Clients.add(ws);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // User registration/identification
        if (data.type === "USER_JOIN") {
          const user: ConnectedUser = {
            ws,
            userId: data.userId || `user_${Date.now()}`,
            username: data.username || '匿名用户',
            role: data.role || 'GUEST',
            deviceType: data.deviceType || 'unknown',
            connectedAt: Date.now(),
            lastActivity: Date.now(),
          };
          connectedUsers.set(ws, user);
          console.log(`[Z3] User joined: ${user.username} (${user.role})`);
          
          // Notify all users about the new user
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
        
        // Update user activity
        const currentUser = connectedUsers.get(ws);
        if (currentUser) {
          currentUser.lastActivity = Date.now();
        }
        
        // Broadcast to all other clients (multi-device sync)
        if (data.type === "SYNC_STATE" || data.type === "VISUAL_EFFECT") {
          z3Clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }

        // Handle ghosting coordination
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
        
        // Chat/message broadcast
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

    // Send welcome message
    ws.send(JSON.stringify({
      type: "CONNECTED",
      message: "Z3 Spirit Core WebSocket active",
      timestamp: Date.now(),
      onlineCount: z3Clients.size,
    }));
  });

  // Z3 API: Get connected users and status
  app.get("/api/z3/status", (req, res) => {
    const users = Array.from(connectedUsers.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      role: u.role,
      deviceType: u.deviceType,
      connectedAt: u.connectedAt,
    }));
    
    res.json({
      connectedDevices: z3Clients.size,
      onlineUsers: users,
      wsPath: "/ws/z3",
      protocol: "SpiritCore_Stream_v7",
    });
  });

  // ===== Z6: Download Task Routes (MASTER ONLY) =====
  
  app.get("/api/z6/downloads", requireMaster, async (req, res) => {
    try {
      const tasks = await storage.getDownloadTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch download tasks" });
    }
  });

  app.post("/api/z6/downloads", requireMaster, async (req, res) => {
    try {
      const { url, category } = req.body;
      if (!url || !category) {
        return res.status(400).json({ error: "Missing url or category" });
      }
      
      const task = await storage.createDownloadTask({
        url,
        category,
        status: "PENDING",
        progress: 0,
      });
      
      await auditAction('DOWNLOAD_CREATED', req.userRole || 'MASTER', 'download_task', task.id, { url, category }, 'SUCCESS', req);
      
      simulateDownload(task.id);
      
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to create download task", details: error });
    }
  });

  app.delete("/api/z6/downloads/:id", requireMaster, async (req, res) => {
    try {
      const success = await storage.deleteDownloadTask(req.params.id);
      if (!success) {
        await auditAction('DOWNLOAD_DELETE_NOTFOUND', req.userRole || 'MASTER', 'download_task', req.params.id, {}, 'FAILED', req);
        return res.status(404).json({ error: "Download task not found" });
      }
      await auditAction('DOWNLOAD_DELETED', req.userRole || 'MASTER', 'download_task', req.params.id, {}, 'SUCCESS', req);
      res.status(204).send();
    } catch (error) {
      await auditAction('DOWNLOAD_DELETE_ERROR', req.userRole || 'MASTER', 'download_task', req.params.id, { error: String(error) }, 'FAILED', req);
      res.status(500).json({ error: "Failed to delete download task" });
    }
  });

  // ===== Z6: Compute Job Routes (MASTER ONLY) =====
  
  app.get("/api/z6/compute", requireMaster, async (req, res) => {
    try {
      const jobs = await storage.getComputeJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch compute jobs" });
    }
  });

  app.post("/api/z6/compute", requireMaster, async (req, res) => {
    try {
      const { jobType, inputPayload, priority } = req.body;
      if (!jobType) {
        return res.status(400).json({ error: "Missing jobType" });
      }
      
      const job = await storage.createComputeJob({
        jobType,
        inputPayload: inputPayload || {},
        priority: priority || 5,
        status: "QUEUED",
        progress: 0,
        sourceDevice: "Z5_MOBILE",
      });
      
      await auditAction('COMPUTE_JOB_CREATED', req.userRole || 'MASTER', 'compute_job', job.id, { jobType, priority }, 'SUCCESS', req);
      
      simulateCompute(job.id);
      
      res.status(201).json(job);
    } catch (error) {
      res.status(400).json({ error: "Failed to create compute job", details: error });
    }
  });

  // ===== Z6: Dream Engine Routes (MASTER ONLY) =====
  
  app.get("/api/z6/dream", requireMaster, async (req, res) => {
    try {
      const logs = await storage.getDreamLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dream logs" });
    }
  });

  app.post("/api/z6/dream", requireMaster, async (req, res) => {
    try {
      const { dreamType } = req.body;
      if (!dreamType) {
        return res.status(400).json({ error: "Missing dreamType" });
      }
      
      await auditAction('DREAM_INITIATED', req.userRole || 'MASTER', 'dream_log', 'new', { dreamType }, 'SUCCESS', req);
      
      const log = await storage.createDreamLog({
        dreamType,
        simulationCount: 0,
        decisionsOptimized: 0,
        status: "SLEEPING",
      });
      
      // Simulate dream processing
      simulateDream(log.id);
      
      res.status(201).json(log);
    } catch (error) {
      res.status(400).json({ error: "Failed to initiate dream", details: error });
    }
  });

  // ===== Z6: Stats Route =====
  
  app.get("/api/z6/stats", requireMaster, async (req, res) => {
    try {
      const stats = await storage.getVaultStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault stats" });
    }
  });

  // ===== P0: Audit Log Routes =====
  
  app.get("/api/audit", requireMaster, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ===== P1: Expert Decision Routes =====
  
  app.get("/api/z4/decisions", async (req, res) => {
    try {
      const expertType = req.query.expertType as string | undefined;
      const decisions = await storage.getExpertDecisions(expertType);
      res.json(decisions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert decisions" });
    }
  });

  app.post("/api/z4/decisions", async (req, res) => {
    try {
      const { expertType, query, chainOfThought, recommendation, confidence, hpCost } = req.body;
      if (!expertType || !query) {
        return res.status(400).json({ error: "Missing expertType or query" });
      }
      
      const decision = await storage.createExpertDecision({
        expertType,
        query,
        chainOfThought,
        recommendation,
        confidence: confidence || 0.5,
        hpCost: hpCost || 0,
      });
      
      await auditAction('EXPERT_DECISION', req.userRole || 'MASTER', 'expert_decision', decision.id, { expertType, query }, 'SUCCESS', req);
      
      res.status(201).json(decision);
    } catch (error) {
      res.status(400).json({ error: "Failed to create expert decision", details: error });
    }
  });

  app.patch("/api/z4/decisions/:id/feedback", async (req, res) => {
    try {
      const { feedbackScore, appliedToZ1 } = req.body;
      const decision = await storage.updateExpertDecision(req.params.id, { 
        feedbackScore, 
        appliedToZ1: appliedToZ1 ? 1 : 0 
      });
      
      if (!decision) {
        return res.status(404).json({ error: "Decision not found" });
      }
      
      if (appliedToZ1) {
        await storage.createEvolutionEvent({
          sourceModule: 'Z4_DECISION',
          eventType: 'WEIGHT_UPDATE',
          previousValue: { applied: false },
          newValue: { applied: true, feedbackScore },
          deltaDescription: `专家决策 ${decision.expertType} 已应用到 Z1 权重`,
          triggeredBy: decision.id,
        });
      }
      
      res.json(decision);
    } catch (error) {
      res.status(500).json({ error: "Failed to update decision feedback" });
    }
  });

  // ===== P1: Evolution Events Routes =====
  
  app.get("/api/evolution", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getEvolutionEvents(limit);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch evolution events" });
    }
  });

  // ===== External API Integration: Weather (国内API) =====
  
  const CITY_CODES: Record<string, string> = {
    '北京': '101010100',
    '上海': '101020100',
    '广州': '101280101',
    '深圳': '101280601',
    '杭州': '101210101',
    '成都': '101270101',
    '武汉': '101200101',
    '西安': '101110101',
    '南京': '101190101',
    '重庆': '101040100',
  };
  
  app.get("/api/external/weather", async (req, res) => {
    try {
      const city = req.query.city as string || '上海';
      const cityCode = CITY_CODES[city] || '101020100';
      
      const response = await fetch(
        `http://t.weather.itboy.net/api/weather/city/${cityCode}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!response.ok) {
        throw new Error('Weather API request failed');
      }
      
      const data = await response.json();
      
      if (data.status !== 200) {
        throw new Error(data.message || 'Weather data unavailable');
      }
      
      const weatherIcons: Record<string, string> = {
        '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌧️', '中雨': '🌧️',
        '大雨': '🌧️', '暴雨': '🌧️', '雷阵雨': '⛈️', '小雪': '🌨️', '中雪': '🌨️',
        '大雪': '🌨️', '雾': '🌫️', '霾': '🌫️', '扬沙': '🌪️', '浮尘': '🌪️',
      };
      
      const currentType = data.data?.forecast?.[0]?.type || '未知';
      const icon = weatherIcons[currentType] || '❓';
      
      const currentTemp = data.data?.wendu || '--';
      const humidity = data.data?.shidu || '--';
      const windDir = data.data?.forecast?.[0]?.fx || '';
      const windLevel = data.data?.forecast?.[0]?.fl || '';
      
      res.json({
        location: { city, cityCode },
        current: {
          temperature: parseInt(currentTemp) || 0,
          humidity: parseInt(humidity) || 0,
          windSpeed: windLevel,
          windDirection: windDir,
          description: currentType,
          icon,
          quality: data.data?.quality || '未知',
          pm25: data.data?.pm25 || 0,
        },
        forecast: data.data?.forecast?.slice(0, 5).map((day: any) => ({
          date: day.ymd,
          tempMax: parseInt(day.high?.replace('高温 ', '').replace('℃', '')) || 0,
          tempMin: parseInt(day.low?.replace('低温 ', '').replace('℃', '')) || 0,
          description: day.type,
          icon: weatherIcons[day.type] || '❓',
          week: day.week,
        })) || [],
        ganmao: data.data?.ganmao || '',
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Weather API Error]:', error);
      res.status(500).json({ error: "获取天气数据失败，请稍后重试" });
    }
  });

  // ===== External API Integration: News (Simulated) =====
  
  app.get("/api/external/news", async (req, res) => {
    try {
      const category = req.query.category as string || 'general';
      
      const mockNews = [
        {
          id: '1',
          title: '人工智能领域取得重大突破',
          summary: '研究人员开发出新型神经网络架构，在多项任务中超越人类水平表现。',
          source: '科技日报',
          category: 'technology',
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          url: '#',
        },
        {
          id: '2',
          title: '全球市场今日走势分析',
          summary: '受多重因素影响，亚太股市呈现震荡态势，分析师建议关注科技板块。',
          source: '财经周刊',
          category: 'finance',
          publishedAt: new Date(Date.now() - 7200000).toISOString(),
          url: '#',
        },
        {
          id: '3',
          title: '健康生活新趋势：智能穿戴设备普及',
          summary: '越来越多人开始使用智能手表和健身追踪器来监测日常健康指标。',
          source: '健康时报',
          category: 'health',
          publishedAt: new Date(Date.now() - 10800000).toISOString(),
          url: '#',
        },
        {
          id: '4',
          title: '新能源汽车销量创历史新高',
          summary: '本月新能源汽车销量突破百万大关，市场渗透率持续攀升。',
          source: '汽车之家',
          category: 'technology',
          publishedAt: new Date(Date.now() - 14400000).toISOString(),
          url: '#',
        },
        {
          id: '5',
          title: '城市绿化工程取得显著成效',
          summary: '多个城市的绿化覆盖率大幅提升，居民生活环境明显改善。',
          source: '环境报',
          category: 'general',
          publishedAt: new Date(Date.now() - 18000000).toISOString(),
          url: '#',
        },
      ];
      
      const filteredNews = category === 'general' 
        ? mockNews 
        : mockNews.filter(n => n.category === category);
      
      res.json({
        articles: filteredNews,
        category,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // ===== Project Management Routes =====

  app.get("/api/projects", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const projects = await storage.getProjects(status);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const project = await storage.createProject(req.body);
      broadcastDataChange('projects', 'CREATE', { id: project.id, title: project.title });
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Failed to create project", details: error });
    }
  });

  app.patch("/api/projects/:id", requireMaster, async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      await auditAction('project_update', req.params.id, (req as any).masterSession || 'master', { status: project.status }, 'SUCCESS');
      broadcastDataChange('projects', 'UPDATE', { id: project.id, status: project.status });
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // ===== Intel Item Routes =====

  app.get("/api/intel", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const items = await storage.getIntelItems(status);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch intel items" });
    }
  });

  app.post("/api/intel", async (req, res) => {
    try {
      const intel = await storage.createIntelItem(req.body);
      broadcastDataChange('intel', 'CREATE', { id: intel.id, title: intel.title });
      res.status(201).json(intel);
    } catch (error) {
      res.status(400).json({ error: "Failed to create intel item", details: error });
    }
  });

  app.patch("/api/intel/:id", requireMaster, async (req, res) => {
    try {
      const intel = await storage.updateIntelItem(req.params.id, req.body);
      if (!intel) {
        return res.status(404).json({ error: "Intel item not found" });
      }
      await auditAction('intel_update', req.params.id, (req as any).masterSession || 'master', { status: intel.status }, 'SUCCESS');
      broadcastDataChange('intel', 'UPDATE', { id: intel.id, status: intel.status });
      res.json(intel);
    } catch (error) {
      res.status(500).json({ error: "Failed to update intel item" });
    }
  });

  // ===== Skill Capsule Routes =====

  app.get("/api/capsules", async (req, res) => {
    try {
      const capsules = await storage.getSkillCapsules();
      res.json(capsules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skill capsules" });
    }
  });

  app.post("/api/capsules", async (req, res) => {
    try {
      const capsule = await storage.createSkillCapsule(req.body);
      broadcastDataChange('capsules', 'CREATE', { id: capsule.id, name: capsule.name });
      res.status(201).json(capsule);
    } catch (error) {
      res.status(400).json({ error: "Failed to create skill capsule", details: error });
    }
  });

  app.patch("/api/capsules/:id", async (req, res) => {
    try {
      const capsule = await storage.updateSkillCapsule(req.params.id, req.body);
      if (!capsule) {
        return res.status(404).json({ error: "Skill capsule not found" });
      }
      broadcastDataChange('capsules', 'UPDATE', { id: capsule.id });
      res.json(capsule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update skill capsule" });
    }
  });

  // ===== Evolution State Routes =====

  app.get("/api/evolution-state", async (req, res) => {
    try {
      const state = await storage.getEvolutionState();
      res.json(state || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch evolution state" });
    }
  });

  app.patch("/api/evolution-state", requireMaster, async (req, res) => {
    try {
      const state = await storage.updateEvolutionState(req.body);
      broadcastDataChange('evolution-state', 'UPDATE', { updated: true });
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: "Failed to update evolution state" });
    }
  });

  // ===== Daily Report Routes =====

  app.get("/api/daily-reports", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const reports = await storage.getDailyReports(limit);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily reports" });
    }
  });

  app.get("/api/daily-reports/today", async (req, res) => {
    try {
      const report = await storage.getTodayReport();
      res.json(report || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch today's report" });
    }
  });

  app.post("/api/daily-reports", async (req, res) => {
    try {
      const report = await storage.createDailyReport(req.body);
      broadcastDataChange('daily-reports', 'CREATE', { id: report.id });
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ error: "Failed to create daily report", details: error });
    }
  });

  app.patch("/api/daily-reports/:id", async (req, res) => {
    try {
      const report = await storage.updateDailyReport(req.params.id, req.body);
      if (!report) {
        return res.status(404).json({ error: "Daily report not found" });
      }
      broadcastDataChange('daily-reports', 'UPDATE', { id: report.id });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to update daily report" });
    }
  });

  // ===== Anchor Persons Approval Routes =====

  app.get("/api/persons/pending", async (req, res) => {
    try {
      const persons = await storage.getPersonsByApprovalStatus('PENDING');
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending persons" });
    }
  });

  app.patch("/api/persons/:id/approval", requireMaster, async (req, res) => {
    try {
      const { approvalStatus } = req.body;
      if (!['CONFIRMED', 'ON_HOLD', 'DELETED', 'PENDING'].includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status" });
      }
      const person = await storage.updatePerson(req.params.id, { approvalStatus });
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      await auditAction('anchor_approval', req.params.id, (req as any).masterSession || 'master', { newStatus: approvalStatus }, 'SUCCESS');
      broadcastDataChange('persons', 'UPDATE', { id: person.id, approvalStatus });
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: "Failed to update person approval" });
    }
  });

  return httpServer;
}

// ===== Z6: Simulation Helpers =====

async function simulateDownload(taskId: string) {
  const stages = [
    { status: "DOWNLOADING", progress: 25 },
    { status: "DOWNLOADING", progress: 50 },
    { status: "DOWNLOADING", progress: 75 },
    { status: "INDEXING", progress: 90 },
    { status: "COMPLETE", progress: 100, sandboxResult: "SAFE" },
  ];
  
  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await storage.updateDownloadTask(taskId, stage as any);
  }
}

async function simulateCompute(jobId: string) {
  const stages = [
    { status: "PROCESSING", progress: 20 },
    { status: "PROCESSING", progress: 50 },
    { status: "PROCESSING", progress: 80 },
    { status: "COMPLETE", progress: 100, processingTimeMs: Math.floor(Math.random() * 5000) + 2000 },
  ];
  
  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await storage.updateComputeJob(jobId, stage as any);
  }
}

async function simulateDream(logId: string) {
  await new Promise(resolve => setTimeout(resolve, 500));
  await storage.updateDreamLog(logId, { status: "DREAMING" });
  
  const simulationCount = Math.floor(Math.random() * 100000) + 10000;
  const decisionsOptimized = Math.floor(simulationCount * 0.05);
  const hpGained = Math.floor(decisionsOptimized * 0.1);
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const insights = {
    topRisk: "市场波动风险",
    suggestedAction: "增加对冲头寸",
    confidence: 0.87,
    hpBonus: hpGained,
  };
  
  await storage.updateDreamLog(logId, {
    status: "AWAKENED",
    simulationCount,
    decisionsOptimized,
    durationMs: Math.floor(Math.random() * 10000) + 5000,
    patchesGenerated: ["optimize_z4_weights", "refine_stress_threshold"],
    insightsDiscovered: insights,
  });
  
  await storage.createEvolutionEvent({
    sourceModule: 'Z6_DREAM',
    eventType: 'HP_GAIN',
    previousValue: { hp: 0 },
    newValue: { hp: hpGained, simulationCount, decisionsOptimized },
    deltaDescription: `梦境推演完成: 模拟 ${simulationCount.toLocaleString()} 次决策路径, 优化 ${decisionsOptimized} 项, HP +${hpGained}`,
    triggeredBy: logId,
  });
  
  await storage.createEvolutionEvent({
    sourceModule: 'Z6_DREAM',
    eventType: 'WEIGHT_UPDATE',
    previousValue: { z4_weights: 'original' },
    newValue: { z4_weights: 'optimized', patches: ['optimize_z4_weights', 'refine_stress_threshold'] },
    deltaDescription: `Z4 策略权重已更新: 应用 2 个优化补丁`,
    triggeredBy: logId,
  });
}
