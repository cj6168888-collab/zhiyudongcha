import type { Express } from "express";
import { z } from "zod";
import {
  predictCommunicationResponse,
  simulateStrategy,
  assessRisk,
  updatePersonPredictionData,
  getPersonPredictionProfile,
} from "../services/oracle-predictor";

const communicationPredictionSchema = z.object({
  personId: z.string().min(1),
  proposedMessage: z.string().min(1),
  context: z.string().optional(),
});

const strategySimulationSchema = z.object({
  personId: z.string().min(1),
  scenarios: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).min(1),
  objective: z.string().min(1),
});

const riskAssessmentSchema = z.object({
  personId: z.string().optional(),
  industry: z.string().optional(),
  projectContext: z.string().optional(),
});

const updatePredictionSchema = z.object({
  personId: z.string().min(1),
  message: z.string().optional(),
  response: z.string().optional(),
  responseTime: z.number().optional(),
  outcome: z.enum(['positive', 'neutral', 'negative']).optional(),
  commitmentKept: z.boolean().optional(),
});

export function registerOracleRoutes(app: Express): void {
  
  app.post("/api/oracle/communication", async (req, res) => {
    try {
      const parsed = communicationPredictionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数错误", details: parsed.error.flatten() });
      }

      const { personId, proposedMessage, context } = parsed.data;
      const prediction = await predictCommunicationResponse(personId, proposedMessage, context);
      
      res.json({
        success: true,
        prediction,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Oracle] 沟通预测错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/oracle/strategy", async (req, res) => {
    try {
      const parsed = strategySimulationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数错误", details: parsed.error.flatten() });
      }

      const { personId, scenarios, objective } = parsed.data;
      const simulation = await simulateStrategy(personId, scenarios, objective);
      
      res.json({
        success: true,
        simulation,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Oracle] 策略模拟错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/oracle/risk", async (req, res) => {
    try {
      const parsed = riskAssessmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数错误", details: parsed.error.flatten() });
      }

      const { personId, industry, projectContext } = parsed.data;
      const assessment = await assessRisk(personId, industry, projectContext);
      
      res.json({
        success: true,
        assessment,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Oracle] 风险评估错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/oracle/update-data", async (req, res) => {
    try {
      const parsed = updatePredictionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数错误", details: parsed.error.flatten() });
      }

      await updatePersonPredictionData(parsed.data.personId, {
        message: parsed.data.message,
        response: parsed.data.response,
        responseTime: parsed.data.responseTime,
        outcome: parsed.data.outcome,
        commitmentKept: parsed.data.commitmentKept,
      });
      
      res.json({
        success: true,
        message: "预测数据已更新",
      });
    } catch (error: any) {
      console.error("[Oracle] 更新预测数据错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/oracle/profile/:personId", async (req, res) => {
    try {
      const { personId } = req.params;
      const profile = await getPersonPredictionProfile(personId);
      
      res.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      console.error("[Oracle] 获取预测档案错误:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/oracle/status", (_req, res) => {
    res.json({
      available: !!process.env.DASHSCOPE_API_KEY,
      version: "1.0.0",
      features: [
        "communication_prediction",
        "strategy_simulation", 
        "risk_assessment",
      ],
    });
  });

  console.log("[Oracle] 预言家协议路由已注册 /api/oracle/*");
}
