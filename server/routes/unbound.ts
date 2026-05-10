/**
 * Project Unbound API Routes (解缚协议 API)
 * 
 * 提供：
 * - Shadow Operator 设备管理和命令执行
 * - Human Simulation 行为模拟配置
 * - Visual Verification 验证报告
 * - V-LLM Grounding 视觉定位
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Unbound');

import type { Express, Request, Response } from 'express';
import type { IStorage } from '../storage';
import type { RouteContext } from './types';
import { requireMaster, requireAuth } from '../middleware/auth';
import { shadowOperator } from '../services/shadow-operator';
import { humanSimulation, BEHAVIOR_PROFILES } from '../services/human-simulation';
import { visualVerification } from '../services/visual-verification';
import { vllmGrounding } from '../services/vllm-grounding';
import { parseActionFromText } from '../services/mock-op-layer';

export function registerUnboundRoutes(
  app: Express,
  storage: IStorage,
  context: RouteContext
): void {

  // ==================== Shadow Operator 路由 ====================

  /**
   * 注册设备
   */
  app.post('/api/unbound/shadow/device/register', requireMaster, async (req: Request, res: Response) => {
    try {
      const { deviceId, deviceType, name, config } = req.body;
      
      if (!deviceId || !deviceType || !name) {
        return res.status(400).json({
          error: '缺少必要字段: deviceId, deviceType, name'
        });
      }
      
      const session = await shadowOperator.registerDevice(
        deviceId,
        deviceType,
        name,
        config ?? {}
      );
      
      res.json({
        success: true,
        session,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 注销设备
   */
  app.delete('/api/unbound/shadow/device/:sessionId', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const success = await shadowOperator.unregisterDevice(sessionId);
      
      res.json({ success });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 获取所有设备会话
   */
  app.get('/api/unbound/shadow/devices', requireAuth, async (req: Request, res: Response) => {
    try {
      const sessions = shadowOperator.getAllSessions();
      res.json({ sessions });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 获取设备会话详情
   */
  app.get('/api/unbound/shadow/device/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = shadowOperator.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: '会话未找到' });
      }
      
      res.json({ session });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 执行单个命令
   */
  app.post('/api/unbound/shadow/execute', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId, action, channel, humanSimulation: humanSim, verification } = req.body;
      
      if (!sessionId || !action) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId, action'
        });
      }
      
      const command = await shadowOperator.executeCommand(sessionId, action, {
        channel,
        humanSimulation: humanSim,
        verification,
      });
      
      res.json({
        success: command.status === 'SUCCESS',
        command,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 从自然语言解析并执行命令
   */
  app.post('/api/unbound/shadow/execute-text', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId, text, humanSimulation: humanSim, verification } = req.body;
      
      if (!sessionId || !text) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId, text'
        });
      }
      
      // 解析动作
      const actions = parseActionFromText(text);
      
      if (actions.length === 0) {
        return res.status(400).json({
          error: '未找到有效的操作指令',
        });
      }
      
      // 执行所有动作
      const commands = await shadowOperator.executeCommands(sessionId, actions, {
        humanSimulation: humanSim,
        verification,
      });
      
      const allSuccess = commands.every(c => c.status === 'SUCCESS');
      
      res.json({
        success: allSuccess,
        commands,
        summary: {
          total: commands.length,
          success: commands.filter(c => c.status === 'SUCCESS').length,
          failed: commands.filter(c => c.status === 'FAILED').length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 便捷操作 - 点击
   */
  app.post('/api/unbound/shadow/click', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId, target } = req.body;
      
      if (!sessionId || !target) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId, target'
        });
      }
      
      const command = await shadowOperator.click(sessionId, target);
      
      res.json({
        success: command.status === 'SUCCESS',
        command,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 便捷操作 - 输入
   */
  app.post('/api/unbound/shadow/type', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId, text } = req.body;
      
      if (!sessionId || !text) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId, text'
        });
      }
      
      const command = await shadowOperator.type(sessionId, text);
      
      res.json({
        success: command.status === 'SUCCESS',
        command,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 便捷操作 - 滑动
   */
  app.post('/api/unbound/shadow/swipe', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId, direction, distance } = req.body;
      
      if (!sessionId || !direction) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId, direction'
        });
      }
      
      const command = await shadowOperator.swipe(sessionId, direction, distance);
      
      res.json({
        success: command.status === 'SUCCESS',
        command,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 截图
   */
  app.post('/api/unbound/shadow/screenshot', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId'
        });
      }
      
      const screenshot = await shadowOperator.screenshot(sessionId);
      
      res.json({
        success: true,
        screenshot,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==================== Human Simulation 路由 ====================

  /**
   * 获取所有行为档案
   */
  app.get('/api/unbound/human-sim/profiles', requireAuth, (req: Request, res: Response) => {
    try {
      const profiles = humanSimulation.getProfiles();
      const current = humanSimulation.getCurrentProfile();
      
      res.json({
        profiles,
        current: current.id,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 切换行为档案
   */
  app.post('/api/unbound/human-sim/profile', requireMaster, (req: Request, res: Response) => {
    try {
      const { profileId } = req.body;
      
      if (!profileId) {
        return res.status(400).json({
          error: '缺少必要字段: profileId'
        });
      }
      
      humanSimulation.setProfile(profileId);
      
      res.json({
        success: true,
        current: humanSimulation.getCurrentProfile(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 生成鼠标轨迹
   */
  app.post('/api/unbound/human-sim/mouse-path', requireAuth, (req: Request, res: Response) => {
    try {
      const { from, to, duration } = req.body;
      
      if (!from || !to) {
        return res.status(400).json({
          error: '缺少必要字段: from, to'
        });
      }
      
      const path = humanSimulation.generateMousePath(from, to, duration);
      
      res.json({
        success: true,
        path,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 生成打字序列
   */
  app.post('/api/unbound/human-sim/typing-sequence', requireAuth, (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({
          error: '缺少必要字段: text'
        });
      }
      
      const sequence = humanSimulation.generateTypingSequence(text);
      
      res.json({
        success: true,
        sequence,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 人类化点击
   */
  app.post('/api/unbound/human-sim/humanize-click', requireAuth, (req: Request, res: Response) => {
    try {
      const { target } = req.body;
      
      if (!target) {
        return res.status(400).json({
          error: '缺少必要字段: target'
        });
      }
      
      const result = humanSimulation.humanizeClick(target);
      
      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==================== Visual Verification 路由 ====================

  /**
   * 获取验证统计
   */
  app.get('/api/unbound/verification/stats', requireAuth, (req: Request, res: Response) => {
    try {
      const stats = visualVerification.getStats();
      const config = visualVerification.getConfig();
      
      res.json({
        stats,
        config,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 获取所有验证报告
   */
  app.get('/api/unbound/verification/reports', requireAuth, (req: Request, res: Response) => {
    try {
      const reports = visualVerification.getAllReports();
      
      res.json({
        reports,
        total: reports.length,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 获取单个验证报告
   */
  app.get('/api/unbound/verification/report/:reportId', requireAuth, (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const report = visualVerification.getReport(reportId);
      
      if (!report) {
        return res.status(404).json({ error: '报告未找到' });
      }
      
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 更新验证配置
   */
  app.patch('/api/unbound/verification/config', requireMaster, (req: Request, res: Response) => {
    try {
      const config = req.body;
      visualVerification.updateConfig(config);
      
      res.json({
        success: true,
        config: visualVerification.getConfig(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 清除历史报告
   */
  app.delete('/api/unbound/verification/reports', requireMaster, (req: Request, res: Response) => {
    try {
      const { olderThanMs } = req.query;
      const cleared = visualVerification.clearReports(
        olderThanMs ? parseInt(olderThanMs as string) : undefined
      );
      
      res.json({
        success: true,
        cleared,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==================== V-LLM Grounding 路由 ====================

  /**
   * 检查 V-LLM 服务状态
   */
  app.get('/api/unbound/vllm/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const available = await vllmGrounding.isAvailable();
      const config = vllmGrounding.getConfig();
      
      res.json({
        available,
        provider: config.provider,
        model: config.model,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 设置 V-LLM 提供商
   */
  app.post('/api/unbound/vllm/provider', requireMaster, (req: Request, res: Response) => {
    try {
      const { provider, apiKey, config } = req.body;
      
      if (!provider) {
        return res.status(400).json({
          error: '缺少必要字段: provider'
        });
      }
      
      if (apiKey) {
        vllmGrounding.setApiKey(apiKey);
      }
      
      vllmGrounding.setProvider(provider, config);
      
      res.json({
        success: true,
        config: vllmGrounding.getConfig(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 定位屏幕元素
   */
  app.post('/api/unbound/vllm/ground', requireAuth, async (req: Request, res: Response) => {
    try {
      const { image, target, context, multiple, preferredRegion } = req.body;
      
      if (!image || !target) {
        return res.status(400).json({
          error: '缺少必要字段: image, target'
        });
      }
      
      const result = await vllmGrounding.ground({
        image,
        target,
        context,
        multiple,
        preferredRegion,
      });
      
      res.json({
        success: result.found,
        result,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 批量定位元素
   */
  app.post('/api/unbound/vllm/ground-multiple', requireAuth, async (req: Request, res: Response) => {
    try {
      const { image, targets } = req.body;
      
      if (!image || !targets || !Array.isArray(targets)) {
        return res.status(400).json({
          error: '缺少必要字段: image, targets (数组)'
        });
      }
      
      const results = await vllmGrounding.groundMultiple(image, targets);
      
      res.json({
        success: true,
        results: Object.fromEntries(results),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 分析整个屏幕
   */
  app.post('/api/unbound/vllm/analyze-screen', requireAuth, async (req: Request, res: Response) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({
          error: '缺少必要字段: image'
        });
      }
      
      const analysis = await vllmGrounding.analyzeScreen(image);
      
      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 查找点击目标
   */
  app.post('/api/unbound/vllm/find-click-target', requireAuth, async (req: Request, res: Response) => {
    try {
      const { image, description } = req.body;
      
      if (!image || !description) {
        return res.status(400).json({
          error: '缺少必要字段: image, description'
        });
      }
      
      const coordinates = await vllmGrounding.findClickTarget(image, description);
      
      res.json({
        found: !!coordinates,
        coordinates,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==================== 综合操作路由 ====================

  /**
   * 智能操作 - 通过自然语言描述执行操作
   * 结合 V-LLM Grounding + Shadow Operator + Human Simulation
   */
  app.post('/api/unbound/smart-action', requireMaster, async (req: Request, res: Response) => {
    try {
      const { sessionId, action, image } = req.body;
      
      if (!sessionId || !action) {
        return res.status(400).json({
          error: '缺少必要字段: sessionId, action'
        });
      }
      
      // 如果提供了图像，使用 V-LLM 定位
      let coordinates: { x: number; y: number } | null = null;
      
      if (image) {
        coordinates = await vllmGrounding.findClickTarget(image, action);
      }
      
      if (coordinates) {
        // 使用定位结果执行点击
        const humanized = humanSimulation.humanizeClick(coordinates);
        
        // 等待人类化延迟
        await new Promise(resolve => setTimeout(resolve, humanized.preDelay));
        
        // 执行点击
        const command = await shadowOperator.click(sessionId, humanized.point);
        
        res.json({
          success: command.status === 'SUCCESS',
          method: 'vllm_grounding',
          coordinates: humanized.point,
          command,
        });
      } else {
        // 尝试解析文本动作
        const actions = parseActionFromText(`[CLICK: ${action}]`);
        
        if (actions.length > 0) {
          const command = await shadowOperator.executeCommand(sessionId, actions[0]);
          
          res.json({
            success: command.status === 'SUCCESS',
            method: 'text_parsing',
            command,
          });
        } else {
          res.status(400).json({
            error: '无法定位目标元素',
            suggestion: '请提供屏幕截图 (image) 以启用视觉定位',
          });
        }
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 获取解缚协议状态总览
   */
  app.get('/api/unbound/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const devices = shadowOperator.getAllSessions();
      const verificationStats = visualVerification.getStats();
      const vllmAvailable = await vllmGrounding.isAvailable();
      const currentProfile = humanSimulation.getCurrentProfile();
      
      res.json({
        status: 'OPERATIONAL',
        version: '1.0.0',
        modules: {
          shadowOperator: {
            devices: devices.length,
            connectedDevices: devices.filter(d => d.status === 'CONNECTED').length,
          },
          humanSimulation: {
            profile: currentProfile.name,
            profileId: currentProfile.id,
          },
          visualVerification: verificationStats,
          vllmGrounding: {
            available: vllmAvailable,
            provider: vllmGrounding.getConfig().provider,
          },
        },
        capabilities: {
          android: ['accessibility_service', 'adb_bridge', 'media_projection'],
          pc: ['interception_driver', 'uinput', 'rpc_gateway'],
          vision: ['screen_diff', 'ocr', 'vllm_grounding'],
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('[Unbound] 解缚协议路由已注册');
}
