import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('InterfaceX');

import type { Express } from "express";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
import { z } from "zod";
import { interfaceX, type EmotionState } from "../services/interface-x";

const extractKeywordsSchema = z.object({
  text: z.string().min(1).max(10000),
  source: z.string().optional().default('unknown'),
});

const updateContextSchema = z.object({
  text: z.string().min(1).max(10000),
  source: z.string().optional().default('unknown'),
});

const setEmotionSchema = z.object({
  state: z.enum(['calm', 'alert', 'warning', 'danger', 'success', 'thinking']),
});

const setRiskSchema = z.object({
  score: z.number().min(0).max(100),
});

export function registerInterfaceXRoutes(app: Express): void {
  
  app.post("/api/interface-x/analyze", async (req, res) => {
    try {
      const parsed = extractKeywordsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const { text, source } = parsed.data;
      interfaceX.updateContext(text, source);
      
      const result = await interfaceX.extractKeywords(text);
      interfaceX.setRiskScore(result.riskLevel);
      
      res.json({
        ...result,
        particleConfig: interfaceX.getParticleConfig(),
      });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Analyze error');
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.post("/api/interface-x/keywords", async (req, res) => {
    try {
      const parsed = extractKeywordsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const { text, source } = parsed.data;
      interfaceX.updateContext(text, source);
      
      const result = await interfaceX.extractKeywords(text);
      interfaceX.setRiskScore(result.riskLevel);
      
      res.json({
        ...result,
        particleConfig: interfaceX.getParticleConfig(),
      });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Keywords error');
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
  
  app.get("/api/interface-x/status", async (req, res) => {
    try {
      res.json({
        emotionState: interfaceX.getEmotionState(),
        riskScore: interfaceX.getRiskScore(),
        particleConfig: interfaceX.getParticleConfig(),
        context: interfaceX.getCurrentContext(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.get("/api/interface-x/state", async (req, res) => {
    try {
      res.json({
        emotionState: interfaceX.getEmotionState(),
        riskScore: interfaceX.getRiskScore(),
        particleConfig: interfaceX.getParticleConfig(),
        context: interfaceX.getCurrentContext(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
  
  app.post("/api/interface-x/context", async (req, res) => {
    try {
      const parsed = updateContextSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      interfaceX.updateContext(parsed.data.text, parsed.data.source);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
  
  app.post("/api/interface-x/emotion", async (req, res) => {
    try {
      const parsed = setEmotionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      interfaceX.setEmotionState(parsed.data.state as EmotionState);
      res.json({
        success: true,
        emotionState: interfaceX.getEmotionState(),
        particleConfig: interfaceX.getParticleConfig(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
  
  app.post("/api/interface-x/risk", async (req, res) => {
    try {
      const parsed = setRiskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      interfaceX.setRiskScore(parsed.data.score);
      res.json({
        success: true,
        riskScore: interfaceX.getRiskScore(),
        emotionState: interfaceX.getEmotionState(),
        particleConfig: interfaceX.getParticleConfig(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
  
  logger.info("[InterfaceX] Routes registered at /api/interface-x/*");
}
