import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { createServiceLogger } from '../lib/logger';
import { insightService } from "../services/InsightService";

const logger = createServiceLogger('InsightsProcessingRoutes');



export function registerInsightsProcessingRoutes(
  app: Express,
  storage: IStorage,
  _context: RouteContext
): void {

  app.get("/api/insights-processing/active", async (req, res) => {
    try {
      const active = await insightService.getActiveInsightsProcessing();
      return res.json(active);
    } catch (error) {
      return res.status(500).json({ error: "获取进度失败" });
    }
  });

  app.get("/api/insights-processing/:id", async (req, res) => {
    try {
      const record = await insightService.getInsightsProcessing(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "记录不存在" });
      }
      return res.json(record);
    } catch (error) {
      return res.status(500).json({ error: "获取进度失败" });
    }
  });

  app.post("/api/insights-processing", async (req, res) => {
    try {
      const record = await insightService.createInsightsProcessing(req.body);
      insightService.simulateInsightsProcessing(record.id, record.sessionId);
      return res.json(record);
    } catch (error) {
      return res.status(400).json({ error: "创建进度记录失败" });
    }
  });

  logger.info('[InsightsProcessing] Routes registered at /api/insights-processing/*');
}
