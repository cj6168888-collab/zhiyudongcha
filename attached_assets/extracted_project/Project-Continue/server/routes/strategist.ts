import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  scanForOpportunities,
  triggerRefinement,
  generateProposal,
  recordUserDecision,
  getStrategistDashboard,
  learnFromAlignmentSignals,
} from "../services/strategist-orchestrator";

const refinementSchema = z.object({
  runType: z.enum(['DREAM', 'QUICK_ANALYSIS', 'DEEP_DIVE']).optional().default('DREAM'),
});

const decisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT', 'MODIFY', 'DEFER']),
  feedback: z.string().optional(),
});

function requireMaster(req: Request, res: Response, next: NextFunction) {
  const role = req.headers['x-avatar-role'] as string;
  if (role !== 'MASTER') {
    return res.status(403).json({ error: '策略家协议仅限MASTER访问' });
  }
  next();
}

export function registerStrategistRoutes(app: Express): void {
  
  app.get("/api/strategist/dashboard", requireMaster, async (_req, res) => {
    try {
      const dashboard = await getStrategistDashboard();
      res.json({
        success: true,
        ...dashboard,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Strategist] 仪表盘获取错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strategist/scan", requireMaster, async (_req, res) => {
    try {
      const opportunities = await scanForOpportunities();
      res.json({
        success: true,
        opportunities,
        count: opportunities.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Strategist] 商机扫描错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strategist/refine/:opportunityId", requireMaster, async (req, res) => {
    try {
      const { opportunityId } = req.params;
      const parsed = refinementSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "参数错误", details: parsed.error.flatten() });
      }

      const { runType } = parsed.data;
      const refinementRun = await triggerRefinement(opportunityId, runType);
      
      res.json({
        success: true,
        refinementRun,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Strategist] 推演触发错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strategist/propose/:opportunityId", requireMaster, async (req, res) => {
    try {
      const { opportunityId } = req.params;
      const { refinementRunId } = req.body as { refinementRunId?: string };
      
      const proposal = await generateProposal(opportunityId, refinementRunId);
      
      res.json({
        success: true,
        proposal,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Strategist] 提案生成错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strategist/decide/:proposalId", requireMaster, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const parsed = decisionSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "参数错误", details: parsed.error.flatten() });
      }

      const { decision, feedback } = parsed.data;
      const result = await recordUserDecision(proposalId, decision, feedback);
      
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Strategist] 决策记录错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strategist/learn", requireMaster, async (_req, res) => {
    try {
      const result = await learnFromAlignmentSignals();
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Strategist] 对齐学习错误:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
