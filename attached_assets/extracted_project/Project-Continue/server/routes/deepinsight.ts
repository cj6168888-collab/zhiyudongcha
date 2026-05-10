/**
 * 小智 DeepInsight Routes - 深度洞察API路由
 * 
 * 功能：
 * 1. 梦境分析API
 * 2. 关系图谱API
 * 3. 共情对话API
 * 4. 设备哨兵API
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, type Express } from 'express';
import type { IStorage } from '../storage';
import { dreamAnalyzer } from '../services/dream-analyzer';
import { empathicDialogue } from '../services/empathic-dialogue';
import { deviceSentry } from '../services/device-sentry';
import { desktopExecutor } from '../services/desktop-executor';
import { nightCycleEngine } from '../services/night-cycle-engine';

export function registerDeepInsightRoutes(app: Express, storage: IStorage) {
  const router = Router();

  router.get('/status', async (req, res) => {
    try {
      const status = {
        nightCycle: nightCycleEngine.getStatus(),
        sentry: deviceSentry.getStatus(),
        slaReport: empathicDialogue.getSLAReport(),
        cachedGraph: dreamAnalyzer.getCachedGraph() ? 'available' : 'not_generated',
        analysisHistory: dreamAnalyzer.getAnalysisHistory().length,
        timestamp: new Date().toISOString(),
      };
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get DeepInsight status' });
    }
  });

  router.post('/dream/analyze', async (req, res) => {
    try {
      const { analysisType = 'comprehensive' } = req.body;
      const result = await dreamAnalyzer.runComprehensiveAnalysis();
      res.json({
        success: true,
        result,
        message: '梦境分析完成',
      });
    } catch (error) {
      console.error('[DeepInsight] Dream analysis error:', error);
      res.status(500).json({ error: 'Dream analysis failed' });
    }
  });

  router.get('/dream/graph', async (req, res) => {
    try {
      let graph = dreamAnalyzer.getCachedGraph();
      if (!graph) {
        graph = await dreamAnalyzer.generateRelationshipGraph();
      }
      res.json(graph);
    } catch (error) {
      console.error('[DeepInsight] Graph generation error:', error);
      res.status(500).json({ error: 'Failed to generate relationship graph' });
    }
  });

  router.get('/dream/insights', async (req, res) => {
    try {
      const insights = await dreamAnalyzer.generateDeepInsights();
      res.json({ insights, count: insights.length });
    } catch (error) {
      console.error('[DeepInsight] Insights error:', error);
      res.status(500).json({ error: 'Failed to generate insights' });
    }
  });

  router.post('/dream/force-cycle', async (req, res) => {
    try {
      const result = await nightCycleEngine.forceDreamCycle();
      res.json({
        success: true,
        result,
        message: '强制梦境周期完成',
      });
    } catch (error) {
      console.error('[DeepInsight] Force cycle error:', error);
      res.status(500).json({ error: 'Force dream cycle failed' });
    }
  });

  router.post('/empathy/analyze', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      const analysis = empathicDialogue.analyzeEmotion(text);
      res.json(analysis);
    } catch (error) {
      console.error('[DeepInsight] Emotion analysis error:', error);
      res.status(500).json({ error: 'Emotion analysis failed' });
    }
  });

  router.get('/empathy/context', async (req, res) => {
    try {
      const context = await empathicDialogue.buildDialogueContext();
      res.json(context);
    } catch (error) {
      console.error('[DeepInsight] Context error:', error);
      res.status(500).json({ error: 'Failed to build dialogue context' });
    }
  });

  router.get('/empathy/sla', async (req, res) => {
    try {
      const report = empathicDialogue.getSLAReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get SLA report' });
    }
  });

  router.post('/empathy/prefix', async (req, res) => {
    try {
      const { emotion = 'neutral' } = req.body;
      const prefix = await empathicDialogue.generateEmpatheticPrefix(emotion);
      res.json({ prefix, emotion });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate empathetic prefix' });
    }
  });

  router.get('/sentry/status', async (req, res) => {
    try {
      const status = deviceSentry.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get sentry status' });
    }
  });

  router.post('/sentry/mode', async (req, res) => {
    try {
      const { mode } = req.body;
      if (!['IDLE', 'LISTENING', 'WATCHING', 'FULL_SENSE', 'STEALTH'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode' });
      }
      await deviceSentry.startSentry(mode);
      res.json({ success: true, mode });
    } catch (error) {
      res.status(500).json({ error: 'Failed to set sentry mode' });
    }
  });

  router.get('/sentry/alerts', async (req, res) => {
    try {
      const alerts = deviceSentry.getPendingAlerts();
      res.json({ alerts, count: alerts.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get alerts' });
    }
  });

  router.post('/sentry/alert/acknowledge', async (req, res) => {
    try {
      const { alertId } = req.body;
      deviceSentry.acknowledgeAlert(alertId);
      res.json({ success: true, alertId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  });

  router.get('/executor/plans', async (req, res) => {
    try {
      const stats = desktopExecutor.getStats();
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get execution plans' });
    }
  });

  router.post('/executor/plan', async (req, res) => {
    try {
      const { name, description, actions } = req.body;
      if (!name || !actions) {
        return res.status(400).json({ error: 'Name and actions are required' });
      }
      const plan = desktopExecutor.createExecutionPlan(name, description || '', actions);
      res.json({ success: true, plan });
    } catch (error) {
      console.error('[DeepInsight] Plan creation error:', error);
      res.status(500).json({ error: 'Failed to create execution plan' });
    }
  });

  router.post('/executor/execute/:planId', async (req, res) => {
    try {
      const { planId } = req.params;
      const result = await desktopExecutor.executePlan(planId);
      res.json({ success: true, result });
    } catch (error) {
      console.error('[DeepInsight] Execution error:', error);
      res.status(500).json({ error: 'Failed to execute plan' });
    }
  });

  router.get('/executor/history', async (req, res) => {
    try {
      const history = desktopExecutor.getRecentActions(50);
      res.json({ history, count: history.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get action history' });
    }
  });

  router.get('/night-cycle/status', async (req, res) => {
    try {
      const status = nightCycleEngine.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get night cycle status' });
    }
  });

  router.post('/night-cycle/activity', async (req, res) => {
    try {
      nightCycleEngine.recordUserActivity();
      res.json({ success: true, message: 'User activity recorded' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to record activity' });
    }
  });

  router.post('/night-cycle/device-status', async (req, res) => {
    try {
      const { charging, battery } = req.body;
      nightCycleEngine.updateDeviceStatus(charging ?? false, battery ?? 100);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update device status' });
    }
  });

  router.get('/night-cycle/queue', async (req, res) => {
    try {
      const queue = nightCycleEngine.getDreamQueue();
      const completed = nightCycleEngine.getCompletedDreamTasks();
      res.json({ queue, completed, queueLength: queue.length, completedCount: completed.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get dream queue' });
    }
  });

  app.use('/api/deepinsight', router);
  
  console.log('[DeepInsight] Routes registered at /api/deepinsight/*');
}

import chrysalisRoutes from './chrysalis';

export function registerChrysalisRoutes(app: Express) {
  app.use('/api/chrysalis', chrysalisRoutes);
  console.log('[Chrysalis] Routes registered at /api/chrysalis/*');
}
