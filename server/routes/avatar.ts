import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Avatar');

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { WebSocket } from "ws";
import { requireMaster, auditAction } from "../middleware/auth";
import { getErrorMessage } from '../lib/errors';
import type { InsertAvatarUserPreferences } from "@shared/schema";
import { 
  chatWithDashScope, 
  executeAvatarCommand, 
  detectUserCommand, 
  deepThinkingChat, 
  classifyAndSaveFiles, 
  type ChatMessage 
} from "../services/dashscope";
import { 
  invokeOraclePower, 
  invokeAegisPower, 
  invokeGnosisPower, 
  invokePrometheusPower,
  getAllPowersStatus,
  recordConversation
} from "../services/avatar-powers";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { skillLearner } from "../services/skill-learner";
import { avatarService } from "../services/AvatarService";

const hpConsumeSchema = z.object({
  amount: z.number().positive('amount必须是正数'),
  reason: z.string().max(200).optional().default('manual'),
});

const hpRechargeSchema = z.object({
  amount: z.number().positive('amount必须是正数'),
  expandMax: z.boolean().optional().default(false),
});

export function registerAvatarRoutes(
  app: Express,
  storage: IStorage,
  context: RouteContext
): void {
  const { chatHistories, z3Clients, broadcastDataChange } = context;
  
  const deepChatHistories: Map<string, ChatMessage[]> = new Map();

  // ===== Avatar AI Chat Routes =====
  
  app.post("/api/avatar/chat", async (req: Request, res: Response) => {
    try {
      const { message, sessionId = 'default' } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      let history = chatHistories.get(sessionId) || [];
      
      // 先尝试匹配已学技能
      try {
        const skillMatch = await skillLearner.matchSkill(message);
        if (skillMatch && skillMatch.confidence >= 0.85) {
          const skillResult = await skillLearner.executeSkill(skillMatch.skill.id);
          if (skillResult.success && skillResult.output) {
            history.push({ role: 'user', content: message });
            history.push({ role: 'assistant', content: skillResult.output });
            chatHistories.set(sessionId, history);
            
            try {
              await avatarService.saveUserMessage(message);
              const aiMsg = await avatarService.saveAIResponse(skillResult.output);
              await skillLearner.recordSkillSuccess(skillMatch.skill.id);
              
              return res.json({
                success: true,
                message: skillResult.output,
                messageId: aiMsg.id,
                command: { action: 'skill_execution', entity: skillMatch.skill.skillName },
                skillUsed: { id: skillMatch.skill.id, name: skillMatch.skill.skillName },
              });
            } catch (e) {
              logger.error({ err: e }, 'Skill execution save error, falling back to AI');
              await skillLearner.recordSkillFailure(skillMatch.skill.id);
              // 保存失败时回退到正常AI对话流程
            }
          } else {
            // 技能执行失败，记录并回退
            await skillLearner.recordSkillFailure(skillMatch.skill.id);
          }
        }
      } catch (skillError) {
        logger.error({ err: skillError }, 'Skill matching error, falling back to AI');
        // 技能匹配出错时继续正常AI对话
      }

      const commandDetection = detectUserCommand(message);
      if (commandDetection.isCommand) {
        try {
           const currentPrefs = await avatarService.getUserPreferences();
          const updates: Partial<InsertAvatarUserPreferences> = {};
          
          if (commandDetection.commandType === 'title') {
            updates.masterTitle = commandDetection.value;
          } else if (commandDetection.commandType === 'style') {
            updates.preferredStyle = commandDetection.value;
          } else if (commandDetection.commandType === 'length') {
            updates.preferredLength = commandDetection.value;
          } else if (commandDetection.commandType === 'custom' && commandDetection.value) {
            const existingRules = currentPrefs?.customRules || [];
            updates.customRules = [...existingRules, commandDetection.value].slice(-10);
          }
          
           await avatarService.updateUserPreferences(updates);
        } catch (e) {
          logger.error({ err: e }, 'Failed to save command preference');
        }
        
        const aiResponse = commandDetection.confirmation || '好的，我记住了～';
        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: aiResponse });
        chatHistories.set(sessionId, history);
        
        try {
           await avatarService.createChatMessage({ role: 'user', content: message });
           const aiMsg = await avatarService.createChatMessage({ role: 'assistant', content: aiResponse });
          void recordConversation(message, aiResponse).catch(e => logger.error({ err: e }, 'Evolution record error'));
          
          return res.json({
            success: true,
            message: aiResponse,
            messageId: aiMsg.id,
            command: { action: 'preference', entity: commandDetection.commandType },
          });
        } catch (e) {
          logger.error({ err: e }, 'Failed to save chat');
          return res.json({
            success: true,
            message: aiResponse,
            command: { action: 'preference', entity: commandDetection.commandType },
          });
        }
      }
      
      const command = await chatWithDashScope(history, message, storage);
      const result = await executeAvatarCommand(command, storage);
      
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: result.message });
      
      void recordConversation(message, result.message).catch(e => logger.error({ err: e }, 'Evolution record error'));
      
      let userMsgId: string | undefined;
      let aiMsgId: string | undefined;
      try {
         const userMsg = await avatarService.createChatMessage({ role: 'user', content: message });
         userMsgId = userMsg.id;
         const aiMsg = await avatarService.createChatMessage({ role: 'assistant', content: result.message });
        aiMsgId = aiMsg.id;
      } catch (e) {
        logger.error({ err: e }, 'Failed to save chat history');
      }
      
      if (history.length > 20) {
        history = history.slice(-20);
      }
      chatHistories.set(sessionId, history);
      
      if (command.chainOfThought) {
        try {
           await avatarService.createExpertDecision({
             expertType: 'STRATEGY',
             query: message,
             chainOfThought: command.chainOfThought,
             recommendation: command.chainOfThought.situation,
             confidence: command.chainOfThought.confidence,
             hpCost: command.chainOfThought.hpCost,
           });
        } catch (e) {
          logger.error({ err: e }, 'Failed to persist expert decision');
        }
      }
      
      return res.json({
        success: result.success,
        message: result.message,
        messageId: aiMsgId,
        command: { action: command.action, entity: command.entity },
        chainOfThought: command.chainOfThought,
        data: result.data,
      });
    } catch (error) {
      logger.error({ err: error }, 'Chat error');
      return res.status(500).json({ success: false, message: "抱歉，我遇到了一些问题。请稍后再试。" });
    }
  });

  app.delete("/api/avatar/chat/:sessionId", async (req: Request, res: Response) => {
    chatHistories.delete(req.params.sessionId);
    res.json({ success: true });
  });

  // ===== 深度思考对话 (使用 qwen-max) =====
  
  app.post("/api/avatar/deep-chat", async (req: Request, res: Response) => {
    try {
      const { message, sessionId = 'default', autoSaveFiles = true } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      let history = deepChatHistories.get(sessionId) || [];
      
      const result = await deepThinkingChat(history, message, storage);
      
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: result.message });
      
      if (history.length > 30) {
        history = history.slice(-30);
      }
      deepChatHistories.set(sessionId, history);
      
      let userMsgId: string | undefined;
      let aiMsgId: string | undefined;
      try {
         const userMsg = await avatarService.createChatMessage({ 
           role: 'user', 
           content: message,
           intent: 'deep_thinking'
         });
         userMsgId = userMsg.id;
         const aiMsg = await avatarService.createChatMessage({ 
           role: 'assistant', 
           content: result.message,
           intent: 'deep_thinking'
         });
        aiMsgId = aiMsg.id;
      } catch (e) {
        logger.error({ err: e }, 'DeepChat failed to save chat history');
      }
      
      let fileSaveResult = null;
      if (autoSaveFiles && result.filesDetected && result.filesDetected.length > 0) {
        logger.info({ filesDetected: result.filesDetected }, 'DeepChat files detected');
        fileSaveResult = await classifyAndSaveFiles(result.filesDetected, storage);
        
        const eventMessage = JSON.stringify({
          type: 'files_saved',
          data: fileSaveResult
        });
        z3Clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(eventMessage);
          }
        });
      }
      
      return res.json({
        success: true,
        message: result.message,
        messageId: aiMsgId,
        filesDetected: result.filesDetected,
        fileSaveResult,
        mode: 'deep_thinking'
      });
    } catch (error) {
      logger.error({ err: error }, 'DeepChat error');
      return res.status(500).json({ success: false, message: "深度思考时遇到了问题，请稍后再试。" });
    }
  });

  app.delete("/api/avatar/deep-chat/:sessionId", async (req: Request, res: Response) => {
    deepChatHistories.delete(req.params.sessionId);
    return res.json({ success: true });
  });

  // ===== Z1: HP (计算资源) 管理 Routes =====
  
  app.get("/api/hp/balance", async (req: Request, res: Response) => {
    try {
      const balance = await avatarService.getHPBalance();
      return res.json(balance);
    } catch (error) {
      logger.error({ err: error }, 'HP get balance error');
      return res.status(500).json({ error: "获取HP余额失败" });
    }
  });

  app.post("/api/hp/consume", requireMaster, async (req: Request, res: Response) => {
    try {
      const validated = hpConsumeSchema.parse(req.body);
      const result = await avatarService.consumeHP(validated.amount, validated.reason);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error || 'HP消耗失败', ...result });
      }
      
      await auditAction('hp_consume', req.userRole || 'MASTER', 'HP', 'consume', { amount: validated.amount, reason: validated.reason }, 'SUCCESS', req);
      broadcastDataChange('hp', 'UPDATE', result);
      
      return res.json(result);
    } catch (error: unknown) {
      logger.error({ err: error }, 'HP consume error');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors?.[0]?.message || '参数验证失败' });
      }
      return res.status(500).json({ error: "HP消耗失败" });
    }
  });

  app.post("/api/hp/recharge", requireMaster, async (req: Request, res: Response) => {
    try {
      const validated = hpRechargeSchema.parse(req.body);
      const result = await avatarService.rechargeHP(validated.amount, validated.expandMax);
      
      await auditAction('hp_recharge', req.userRole || 'MASTER', 'HP', 'recharge', { amount: validated.amount, expandMax: validated.expandMax }, 'SUCCESS', req);
      broadcastDataChange('hp', 'UPDATE', result);
      
      return res.json(result);
    } catch (error: unknown) {
      logger.error({ err: error }, 'HP recharge error');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors?.[0]?.message || '参数验证失败' });
      }
      return res.status(500).json({ error: "HP充值失败" });
    }
  });

  // ===== Avatar Chat History & Feedback Routes =====
  
  app.get("/api/avatar/chat-history", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
       const history = await avatarService.getChatHistory(limit);
      return res.json(history);
    } catch (error) {
      logger.error({ err: error }, 'Get chat history error');
      return res.status(500).json({ error: "获取对话历史失败" });
    }
  });

  app.post("/api/avatar/chat-feedback", async (req: Request, res: Response) => {
    try {
      const { messageId, feedback, note, userMessage, assistantResponse, sessionId } = req.body;
      if (!messageId || feedback === undefined) {
        return res.status(400).json({ error: "messageId和feedback是必需的" });
      }
       const updated = await avatarService.updateChatFeedback(messageId, feedback, note);
       
       const prefs = await avatarService.getUserPreferences();
      const totalChats = (prefs?.totalChats || 0) + 1;
      const positiveCount = (prefs?.positiveCount || 0) + (feedback === 1 ? 1 : 0);
      const negativeCount = (prefs?.negativeCount || 0) + (feedback === -1 ? 1 : 0);
       await avatarService.updateUserPreferences({ totalChats, positiveCount, negativeCount });
      
      // 如果是正面反馈，尝试从对话中学习
      if (feedback === 1) {
        try {
          let userMsg = userMessage;
          let assistantMsg = assistantResponse;
          
          // 如果客户端没有提供消息内容，从最近的对话历史中查找
          if (!userMsg || !assistantMsg) {
             const recentChats = await avatarService.getRecentChatContext(10);
            // 查找assistant消息（被反馈的消息）
            const assistantIdx = recentChats.findIndex(c => c.id === messageId);
            if (assistantIdx > 0 && recentChats[assistantIdx - 1]?.role === 'user') {
              userMsg = recentChats[assistantIdx - 1].content;
              assistantMsg = recentChats[assistantIdx].content;
            } else if (updated && updated.role === 'assistant') {
              // 用反馈返回的消息内容
              assistantMsg = updated.content;
              // 查找紧邻的用户消息
              const prevUserMsg = recentChats.find((c, i) => 
                i < recentChats.length - 1 && 
                c.role === 'user' && 
                recentChats[i + 1]?.id === messageId
              );
              if (prevUserMsg) userMsg = prevUserMsg.content;
            }
          }
          
          if (userMsg && assistantMsg) {
            await skillLearner.learnFromConversation(
              sessionId || messageId,
              [userMsg],
              [assistantMsg],
              true
            );
            logger.info('SkillLearner learned from positive feedback conversation');
          }
        } catch (e) {
          logger.error({ err: e }, 'SkillLearner failed to learn from conversation');
        }
      }
      
      return res.json({ success: true, updated });
    } catch (error) {
      logger.error({ err: error }, 'Feedback error');
      return res.status(500).json({ error: "保存反馈失败" });
    }
  });

  app.get("/api/avatar/user-preferences", async (req: Request, res: Response) => {
    try {
       const prefs = await avatarService.getUserPreferences();
      res.json(prefs || { totalChats: 0, positiveCount: 0, negativeCount: 0 });
    } catch (error) {
      res.status(500).json({ error: "获取用户偏好失败" });
    }
  });

  app.get("/api/avatar/memorized-chats", async (req: Request, res: Response) => {
    try {
       const memories = await avatarService.getMemorizedChats();
      res.json(memories);
    } catch (error) {
      res.status(500).json({ error: "获取记忆对话失败" });
    }
  });

  // ===== Avatar Powers API =====
  
  app.get("/api/avatar/powers", async (req: Request, res: Response) => {
    try {
      const status = getAllPowersStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get powers status" });
    }
  });

  app.get("/api/avatar/powers/oracle", async (req: Request, res: Response) => {
    try {
      const insights = await invokeOraclePower();
      res.json({ power: '神谕之力', status: 'active', insights });
    } catch (error) {
      res.status(500).json({ error: "神谕之力暂时无法启动" });
    }
  });

  app.get("/api/avatar/powers/aegis", async (req: Request, res: Response) => {
    try {
      const status = await invokeAegisPower();
      res.json({ power: '圣盾之力', status: 'active', ...status });
    } catch (error) {
      res.status(500).json({ error: "圣盾之力暂时无法启动" });
    }
  });

  app.get("/api/avatar/powers/gnosis", async (req: Request, res: Response) => {
    try {
      const memory = await invokeGnosisPower();
      res.json({ power: '灵知之力', status: 'active', ...memory });
    } catch (error) {
      res.status(500).json({ error: "灵知之力暂时无法启动" });
    }
  });

  app.get("/api/avatar/powers/prometheus", async (req: Request, res: Response) => {
    try {
      const evolution = await invokePrometheusPower();
      res.json({ power: '普罗米修斯之力', status: 'active', ...evolution });
    } catch (error) {
      res.status(500).json({ error: "普罗米修斯之力暂时无法启动" });
    }
  });
}
