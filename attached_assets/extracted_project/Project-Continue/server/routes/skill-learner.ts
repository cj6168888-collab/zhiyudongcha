import type { Express } from "express";
import { z } from "zod";
import { skillLearner } from "../services/skill-learner";

const stepSchema = z.object({
  order: z.number(),
  action: z.string(),
  params: z.record(z.any()).optional(),
  description: z.string().optional(),
});

const teachSkillSchema = z.object({
  skillName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(["task", "query", "action", "workflow"]).optional(),
  triggerPatterns: z.array(z.string().min(1).max(200)).min(1).max(20),
  steps: z.array(stepSchema).optional().default([]),
  expectedOutput: z.string().max(2000).optional(),
});

const matchSkillSchema = z.object({
  userInput: z.string().min(1).max(500),
});

const learnConversationSchema = z.object({
  conversationId: z.string().optional(),
  userMessages: z.array(z.string()).optional().default([]),
  assistantResponses: z.array(z.string()).optional().default([]),
  wasHelpful: z.boolean().optional().default(true),
});

const patternSchema = z.object({
  patternType: z.enum(["question", "complaint", "request", "greeting", "other"]),
  patternText: z.string().min(1).max(500),
  keywords: z.array(z.string()).optional().default([]),
  responseTemplate: z.string().max(2000).optional(),
});

const skillIdSchema = z.object({
  skillId: z.string().uuid(),
});

const updateSkillSchema = z.object({
  skillName: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(["task", "query", "action", "workflow"]).optional(),
  triggerPatterns: z.array(z.string().min(1).max(200)).optional(),
  steps: z.array(stepSchema).optional(),
  expectedOutput: z.string().max(2000).optional(),
  isActive: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export function registerSkillLearnerRoutes(app: Express): void {
  
  app.post("/api/skills/teach", async (req, res) => {
    try {
      const parsed = teachSkillSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const { skillName, description, category, triggerPatterns, steps, expectedOutput } = parsed.data;
      
      const skill = await skillLearner.teachSkill({
        skillName,
        description,
        category,
        triggerPatterns,
        steps,
        expectedOutput,
      });
      
      res.json({ success: true, skill });
    } catch (error: any) {
      console.error("[SkillLearner] Teach error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/match", async (req, res) => {
    try {
      const parsed = matchSkillSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const match = await skillLearner.matchSkill(parsed.data.userInput);
      res.json({ match });
    } catch (error: any) {
      console.error("[SkillLearner] Match error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/:skillId/execute", async (req, res) => {
    try {
      const parsed = skillIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid skillId", details: parsed.error.flatten() });
      }
      const result = await skillLearner.executeSkill(parsed.data.skillId);
      res.json(result);
    } catch (error: any) {
      console.error("[SkillLearner] Execute error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/:skillId/success", async (req, res) => {
    try {
      const parsed = skillIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid skillId", details: parsed.error.flatten() });
      }
      await skillLearner.recordSkillSuccess(parsed.data.skillId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/:skillId/failure", async (req, res) => {
    try {
      const parsed = skillIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid skillId", details: parsed.error.flatten() });
      }
      await skillLearner.recordSkillFailure(parsed.data.skillId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/skills", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const skills = await skillLearner.listSkills(category);
      res.json({ skills });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch("/api/skills/:skillId", async (req, res) => {
    try {
      const paramsParsed = skillIdSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: "Invalid skillId", details: paramsParsed.error.flatten() });
      }
      
      const bodyParsed = updateSkillSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: bodyParsed.error.flatten() });
      }
      
      const skill = await skillLearner.updateSkill(paramsParsed.data.skillId, bodyParsed.data);
      res.json({ skill });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete("/api/skills/:skillId", async (req, res) => {
    try {
      const parsed = skillIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid skillId", details: parsed.error.flatten() });
      }
      await skillLearner.deactivateSkill(parsed.data.skillId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/learn-from-conversation", async (req, res) => {
    try {
      const parsed = learnConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const { conversationId, userMessages, assistantResponses, wasHelpful } = parsed.data;
      
      const skill = await skillLearner.learnFromConversation(
        conversationId || `conv_${Date.now()}`,
        userMessages,
        assistantResponses,
        wasHelpful
      );
      
      res.json({ skill });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/suggest-response", async (req, res) => {
    try {
      const parsed = matchSkillSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const suggestion = await skillLearner.suggestAutoResponse(parsed.data.userInput);
      res.json(suggestion);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/skills/stats", async (req, res) => {
    try {
      const stats = await skillLearner.getSkillStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/patterns", async (req, res) => {
    try {
      const patternType = req.query.type as string | undefined;
      const patterns = await skillLearner.listPatterns(patternType);
      res.json({ patterns });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/patterns", async (req, res) => {
    try {
      const parsed = patternSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const { patternType, patternText, keywords, responseTemplate } = parsed.data;
      
      const pattern = await skillLearner.recordPattern(
        patternType,
        patternText,
        keywords,
        responseTemplate
      );
      
      res.json({ pattern });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/patterns/:patternId/enable-auto", async (req, res) => {
    try {
      const { patternId } = req.params;
      await skillLearner.enableAutoRespond(patternId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Phase 3.2: 反馈记录 API
  const feedbackSchema = z.object({
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    skillId: z.string().optional(),
    feedbackType: z.enum(["LIKE", "DISLIKE", "FOLLOWUP", "ADOPT", "IGNORE"]),
    userMessage: z.string().optional(),
    assistantResponse: z.string().optional(),
    category: z.string().optional(),
    followupCount: z.number().optional(),
    wasAdopted: z.number().optional(),
    sentiment: z.string().optional(),
  });
  
  app.post("/api/skills/feedback", async (req, res) => {
    try {
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      
      const feedback = await skillLearner.recordFeedback(parsed.data);
      res.json({ success: true, feedback });
    } catch (error: any) {
      console.error("[SkillLearner] Feedback error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/skills/feedback", async (req, res) => {
    try {
      const { category, feedbackType, limit, offset } = req.query;
      const feedbackHistory = await skillLearner.getFeedbackHistory({
        category: category as string,
        feedbackType: feedbackType as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json({ success: true, feedback: feedbackHistory });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/skills/followup", async (req, res) => {
    try {
      const { conversationId, messageId } = req.body;
      if (!conversationId || !messageId) {
        return res.status(400).json({ error: "conversationId and messageId required" });
      }
      await skillLearner.recordFollowup(conversationId, messageId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Phase 3.2: 能力曲线 API
  app.get("/api/skills/proficiency/curve", async (req, res) => {
    try {
      const { category, startDate, endDate, limit } = req.query;
      const curve = await skillLearner.getProficiencyCurve({
        category: category as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json({ success: true, curve });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/skills/proficiency/summary", async (req, res) => {
    try {
      const summary = await skillLearner.getCategorySummary();
      res.json({ success: true, summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/skills/proficiency/followup-analysis", async (req, res) => {
    try {
      const analysis = await skillLearner.analyzeFollowupPatterns();
      res.json({ success: true, analysis });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log("[SkillLearner] Routes registered at /api/skills/*, /api/patterns/*, /api/skills/proficiency/*");
}
