/**
 * 小智 Hybrid AI Routes - 混合智能API
 *
 * 提供：
 * 1. 模型状态查询
 * 2. 设备管理
 * 3. 任务队列管理
 * 4. 配置更新
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('HybridAi');

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireMaster } from "../middleware/auth";
import {
  getModelStatus,
  routeToModel,
  analyzeTaskComplexity,
  addServerConfig,
  removeServerConfig,
  getServerConfigs,
  checkServerHealth,
  type ModelConfig,
  type ServerConfig
} from "../services/model-router";
import { deviceRegistry, type DeviceCapabilities, type DeviceType } from "../services/device-registry";
import { inferenceQueue, type JobType, type JobPriority } from "../services/inference-queue";
import { ollamaAdapter, OllamaAdapter } from "../services/ollama-adapter";
import type { IStorage } from "../storage";

export function registerHybridAIRoutes(app: Express, storage: IStorage): void {

  // ===== 模型状态API =====

  app.get("/api/model/status", async (req: Request, res: Response) => {
    try {
      const status = await getModelStatus();
      const ollamaModels = await ollamaAdapter.listModels();
      const recommendedModels = OllamaAdapter.getRecommendedModels();

      res.json({
        success: true,
        status: {
          ...status,
          ollamaModels: ollamaModels.map(m => ({
            name: m.name,
            size: m.size,
            modifiedAt: m.modifiedAt,
          })),
          recommendedModels,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Model status error');
      res.status(500).json({ error: "获取模型状态失败" });
    }
  });

  app.get("/api/model/health", async (req: Request, res: Response) => {
    try {
      const localHealthy = await ollamaAdapter.checkHealth();
      const cloudHealthy = !!process.env.DASHSCOPE_API_KEY;

      res.json({
        success: true,
        local: {
          available: localHealthy,
          endpoint: 'http://localhost:11434',
        },
        cloud: {
          available: cloudHealthy,
          provider: 'DashScope',
        },
        hybridReady: localHealthy || cloudHealthy,
      });
    } catch (error) {
      res.status(500).json({ error: "健康检查失败" });
    }
  });

  // 分析任务复杂度
  app.post("/api/model/analyze-complexity", async (req: Request, res: Response) => {
    try {
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "缺少message参数" });
      }

      const complexity = analyzeTaskComplexity(message, context);

      res.json({
        success: true,
        complexity,
        recommendation: complexity.level === 'SIMPLE' ? 'LOCAL' :
                        complexity.level === 'COMPLEX' ? 'CLOUD' : 'HYBRID',
      });
    } catch (error) {
      res.status(500).json({ error: "复杂度分析失败" });
    }
  });

  // ===== 设备管理API =====

  const deviceRegisterSchema = z.object({
    deviceId: z.string().min(1),
    name: z.string().min(1).max(100),
    type: z.enum(['MOBILE', 'TABLET', 'LAPTOP', 'DESKTOP', 'SERVER', 'EDGE', 'AR_GLASSES', 'UNKNOWN']),
    capabilities: z.object({
      canRunLocalModel: z.boolean(),
      localModelName: z.string().optional(),
      maxModelSize: z.string().optional(),
      gpuAvailable: z.boolean().optional(),
      gpuMemoryMB: z.number().optional(),
      canExecuteScreenActions: z.boolean(),
      hasAccessibility: z.boolean(),
      hasOCR: z.boolean(),
      cpuCores: z.number(),
      memoryMB: z.number(),
      batteryLevel: z.number().optional(),
      isPluggedIn: z.boolean().optional(),
      networkType: z.enum(['wifi', 'ethernet', 'cellular', 'unknown']).optional(),
      screenWidth: z.number().optional(),
      screenHeight: z.number().optional(),
      features: z.array(z.string()),
    }),
  });

  app.post("/api/devices/register", requireMaster, async (req: Request, res: Response) => {
    try {
      const parseResult = deviceRegisterSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "参数无效",
          details: parseResult.error.flatten(),
        });
      }

      const { deviceId, name, type, capabilities } = parseResult.data;
      const userId = req.userId || 'master';
      const userRole = req.userRole || 'MASTER';

      const device = deviceRegistry.registerDevice(
        deviceId,
        name,
        type as DeviceType,
        capabilities as DeviceCapabilities,
        userId,
        userRole as 'MASTER' | 'GUEST'
      );

      res.json({
        success: true,
        device: {
          id: device.id,
          name: device.name,
          type: device.type,
          status: device.status,
          sessionId: device.sessionId,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Device register error');
      res.status(500).json({ error: "设备注册失败" });
    }
  });

  app.get("/api/devices", async (req: Request, res: Response) => {
    try {
      const status = deviceRegistry.getStatus();
      const onlineDevices = deviceRegistry.getOnlineDevices();

      res.json({
        success: true,
        ...status,
        devices: onlineDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          status: d.status,
          capabilities: {
            canRunLocalModel: d.capabilities.canRunLocalModel,
            gpuAvailable: d.capabilities.gpuAvailable,
            memoryMB: d.capabilities.memoryMB,
          },
          connectedAt: d.connectedAt,
          lastHeartbeat: d.lastHeartbeat,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "获取设备列表失败" });
    }
  });

  app.post("/api/devices/:deviceId/heartbeat", async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { status, cpuUsage, memoryUsage, batteryLevel, activeJobs } = req.body;

      const success = deviceRegistry.updateHeartbeat({
        deviceId,
        timestamp: Date.now(),
        status: status || 'ONLINE',
        cpuUsage,
        memoryUsage,
        batteryLevel,
        activeJobs,
      });

      if (!success) {
        return res.status(404).json({ error: "设备未找到" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "心跳更新失败" });
    }
  });

  app.delete("/api/devices/:deviceId", requireMaster, async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const success = deviceRegistry.unregisterDevice(deviceId);

      if (!success) {
        return res.status(404).json({ error: "设备未找到" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "设备注销失败" });
    }
  });

  // ===== 任务队列API =====

  const jobAddSchema = z.object({
    type: z.enum(['CHAT', 'EXPERT_ANALYSIS', 'MULTI_EXPERT', 'SYNTHESIS', 'EMBEDDING']),
    input: z.object({
      userMessage: z.string().min(1),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).optional(),
      context: z.string().optional(),
      expertType: z.string().optional(),
    }),
    priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'BACKGROUND']).optional(),
    preferLocal: z.boolean().optional(),
    targetDevice: z.string().optional(),
  });

  app.post("/api/queue/jobs", requireMaster, async (req: Request, res: Response) => {
    try {
      const parseResult = jobAddSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "参数无效",
          details: parseResult.error.flatten(),
        });
      }

      const { type, input, priority, preferLocal, targetDevice } = parseResult.data;

      const job = inferenceQueue.addJob(
        type as JobType,
        input,
        {
          priority: priority as JobPriority,
          preferLocal,
          targetDevice,
          userId: req.userId,
        }
      );

      res.json({
        success: true,
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          priority: job.priority,
          createdAt: job.createdAt,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Job add error');
      res.status(500).json({ error: "添加任务失败" });
    }
  });

  app.get("/api/queue/status", async (req: Request, res: Response) => {
    try {
      const status = inferenceQueue.getQueueStatus();

      res.json({
        success: true,
        queue: {
          pending: status.pending,
          running: status.running,
          completed: status.completed,
          failed: status.failed,
        },
        recentJobs: status.jobs.slice(-10).map(j => ({
          id: j.id,
          type: j.type,
          status: j.status,
          createdAt: j.createdAt,
          completedAt: j.completedAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "获取队列状态失败" });
    }
  });

  app.get("/api/queue/jobs/:jobId", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = inferenceQueue.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: "任务未找到" });
      }

      res.json({
        success: true,
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          priority: job.priority,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          retryCount: job.retryCount,
          result: job.result,
          error: job.error,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "获取任务失败" });
    }
  });

  app.delete("/api/queue/jobs/:jobId", requireMaster, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const success = inferenceQueue.cancelJob(jobId);

      if (!success) {
        return res.status(400).json({ error: "无法取消任务（可能已完成或不存在）" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "取消任务失败" });
    }
  });

  // ===== Ollama模型管理 =====

  app.get("/api/ollama/models", async (req: Request, res: Response) => {
    try {
      const models = await ollamaAdapter.listModels();
      const recommended = OllamaAdapter.getRecommendedModels();

      res.json({
        success: true,
        installed: models.map(m => ({
          name: m.name,
          size: m.size,
          modifiedAt: m.modifiedAt,
          details: m.details,
        })),
        recommended,
      });
    } catch (error) {
      res.status(500).json({ error: "获取模型列表失败" });
    }
  });

  app.post("/api/ollama/pull", requireMaster, async (req: Request, res: Response) => {
    try {
      const { model } = req.body;

      if (!model) {
        return res.status(400).json({ error: "缺少model参数" });
      }

      // 开始拉取（这是一个长时间操作）
      res.json({
        success: true,
        message: `开始拉取模型: ${model}`,
        note: "模型下载可能需要几分钟到几十分钟，请稍候",
      });

      // 异步拉取
      ollamaAdapter.pullModel(model, (progress) => {
        logger.info(`[Ollama] Pull progress: ${(progress * 100).toFixed(1)}%`);
      }).then(success => {
        logger.info(`[Ollama] Pull ${model}: ${success ? 'SUCCESS' : 'FAILED'}`);
      }).catch(err => {
        logger.error({ err, model }, 'Ollama pull error');
      });

    } catch (error) {
      res.status(500).json({ error: "拉取模型失败" });
    }
  });

  app.post("/api/ollama/test", async (req: Request, res: Response) => {
    try {
      const { prompt, model } = req.body;

      const result = await ollamaAdapter.generate(
        prompt || "请用一句话介绍你自己",
        { model }
      );

      if (!result) {
        return res.status(503).json({
          error: "本地模型不可用",
          hint: "请确保Ollama正在运行且模型已下载",
        });
      }

      res.json({
        success: true,
        response: result,
        model: model || 'default',
      });
    } catch (error) {
      res.status(500).json({ error: "测试失败" });
    }
  });

  // ===== GPU服务器配置API =====

  const serverConfigSchema = z.object({
    endpoint: z.string().url(),
    model: z.string().min(1),
    name: z.string().optional(),
    gpuMemoryMB: z.number().optional(),
    ramMB: z.number().optional(),
    cpuCores: z.number().optional(),
    maxConcurrent: z.number().optional(),
    enabled: z.boolean().optional(),
    taskType: z.enum(['CHAT', 'SCREEN_OPERATION', 'COMPLEX_ANALYSIS', 'EXPERT']).optional(),
  });

  app.get("/api/servers", requireMaster, async (req: Request, res: Response) => {
    try {
      const servers = getServerConfigs();
      const statusPromises = servers.map(async (s) => ({
        ...s,
        healthy: await checkServerHealth(s.endpoint),
      }));
      const serversWithStatus = await Promise.all(statusPromises);

      res.json({
        success: true,
        servers: serversWithStatus,
        count: servers.length,
        healthyCount: serversWithStatus.filter(s => s.healthy).length,
      });
    } catch (error) {
      res.status(500).json({ error: "获取服务器列表失败" });
    }
  });

  app.post("/api/servers", requireMaster, async (req: Request, res: Response) => {
    try {
      const parseResult = serverConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "参数无效",
          details: parseResult.error.flatten(),
        });
      }

      const config = parseResult.data as ServerConfig;

      // 测试连接
      const healthy = await checkServerHealth(config.endpoint);
      if (!healthy) {
        return res.status(400).json({
          error: "无法连接到服务器",
          hint: `请确保Ollama在 ${config.endpoint} 正在运行`,
        });
      }

      addServerConfig(config);

      res.json({
        success: true,
        message: `服务器 ${config.name || config.endpoint} 已添加`,
        server: {
          ...config,
          healthy: true,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Add server error');
      res.status(500).json({ error: "添加服务器失败" });
    }
  });

  app.delete("/api/servers", requireMaster, async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ error: "缺少endpoint参数" });
      }

      const success = removeServerConfig(endpoint);

      if (!success) {
        return res.status(404).json({ error: "服务器未找到" });
      }

      res.json({ success: true, message: "服务器已移除" });
    } catch (error) {
      res.status(500).json({ error: "移除服务器失败" });
    }
  });

  app.post("/api/servers/test", requireMaster, async (req: Request, res: Response) => {
    try {
      const { endpoint, model, prompt } = req.body;

      if (!endpoint) {
        return res.status(400).json({ error: "缺少endpoint参数" });
      }

      // 先检查健康状态
      const healthy = await checkServerHealth(endpoint);
      if (!healthy) {
        return res.status(503).json({
          error: "服务器不可用",
          endpoint,
        });
      }

      // 测试推理
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'qwen2:72b',
          prompt: prompt || '你好，请用一句话介绍你自己。',
          stream: false,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        return res.status(503).json({
          error: "推理请求失败",
          status: response.status,
        });
      }

      const result = await response.json();

      res.json({
        success: true,
        response: result.response,
        model: model || 'qwen2:72b',
        endpoint,
        evalCount: result.eval_count,
        totalDuration: result.total_duration,
      });
    } catch (error) {
      logger.error({ err: error }, 'Server test error');
      res.status(500).json({ error: "测试服务器失败" });
    }
  });

  // 获取服务器上的可用模型
  app.get("/api/servers/models", requireMaster, async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.query;

      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: "缺少endpoint参数" });
      }

      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return res.status(503).json({ error: "无法获取模型列表" });
      }

      const data = await response.json();

      res.json({
        success: true,
        endpoint,
        models: data.models || [],
      });
    } catch (error) {
      res.status(500).json({ error: "获取服务器模型失败" });
    }
  });

  logger.info('[HybridAI] Routes registered (with GPU server support)');
}
