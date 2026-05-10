import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { createServiceLogger } from '../lib/logger';
import { requireAuth, requireMaster, auditAction } from "../middleware/auth";
import { userService } from '../services/UserService';
import { evolutionService } from '../services/EvolutionService';
import { webSocketManager } from '../websocket';
import { z } from "zod";

const logger = createServiceLogger('HPEconomyRoutes');

const HP_COSTS: Record<string, number> = {
  INTEL_DEEP_SCAN: 100,
  AUTONOMOUS_EDIT: 50,
  DREAM_SIMULATION: 20,
  EXPERT_ANALYZE: 30,
  MULTI_EXPERT_ANALYZE: 80,
  BIO_EMERGENCY: 0,
  DEFAULT: 10,
};

const hpConsumeSchema = z.object({
  actionType: z.string().min(1),
  amount: z.number().optional(),
});

const hpRechargeSchema = z.object({
  amount: z.number().min(1).max(10000),
});

export function registerHPEconomyRoutes(
  app: Express,
  storage: IStorage,
  _context: RouteContext
): void {

  app.get("/api/hp/balance", requireAuth, async (req, res) => {
    try {
      const userId = 'master';
      const settings = await userService.getUserSettings(userId);

      res.json({
        balance: settings.hpBalance || 1000,
        maxBalance: settings.hpMaxBalance || 1000,
        totalConsumed: settings.hpTotalConsumed || 0,
        totalRecharged: settings.hpTotalRecharged || 0,
        lastRechargeAt: settings.hpLastRechargeAt,
      });
    } catch (error) {
      logger.error({ err: error }, '[HP] Balance fetch error');
      res.status(500).json({ error: "获取HP余额失败" });
    }
  });

  app.post("/api/hp/consume", requireAuth, async (req, res) => {
    try {
      const parseResult = hpConsumeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "请求参数无效" });
      }

      const { actionType, amount } = parseResult.data;
      const cost = amount ?? HP_COSTS[actionType] ?? HP_COSTS.DEFAULT;

      const userId = 'master';
      const settings = await userService.getUserSettings(userId);

      const currentBalance = settings.hpBalance || 1000;

      if (currentBalance < cost) {
        return res.status(400).json({
          success: false,
          error: "HP不足",
          balance: currentBalance,
          required: cost,
        });
      }

      const newBalance = currentBalance - cost;
      const newTotalConsumed = (settings.hpTotalConsumed || 0) + cost;

      await userService.updateUserSettings(userId, {
        hpBalance: newBalance,
        hpTotalConsumed: newTotalConsumed,
      });

      await auditAction('HP_CONSUME', req.userRole || 'MASTER', 'hp', actionType,
        { actionType, cost, newBalance }, 'SUCCESS', req
      );

      logger.info(`[HP] Consumed ${cost} for ${actionType}, balance: ${newBalance}`);

      // 广播 HP 变更
      webSocketManager.broadcast('HP_UPDATED', { balance: newBalance, consumed: cost, actionType });

      // HP 消耗对应 XP 获得（比例 1:1）
      void evolutionService.gainXp(cost, `HP_CONSUME:${actionType}`);

      res.json({
        success: true,
        consumed: cost,
        balance: newBalance,
        actionType,
      });
    } catch (error) {
      logger.error({ err: error }, '[HP] Consume error');
      res.status(500).json({ error: "HP消耗失败" });
    }
  });

  app.post("/api/hp/recharge", requireMaster, async (req, res) => {
    try {
      const parseResult = hpRechargeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "请求参数无效" });
      }

      const { amount } = parseResult.data;
      const userId = 'master';

      const settings = await userService.getUserSettings(userId);

      const currentBalance = settings.hpBalance || 0;
      const maxBalance = settings.hpMaxBalance || 1000;
      const newBalance = Math.min(currentBalance + amount, maxBalance);
      const actualAdded = newBalance - currentBalance;
      const newTotalRecharged = (settings.hpTotalRecharged || 0) + actualAdded;

      await userService.updateUserSettings(userId, {
        hpBalance: newBalance,
        hpTotalRecharged: newTotalRecharged,
        hpLastRechargeAt: new Date(),
      });

      await auditAction('HP_RECHARGE', req.userRole || 'MASTER', 'hp', 'recharge',
        { amount, actualAdded, newBalance }, 'SUCCESS', req
      );

      logger.info(`[HP] Recharged ${actualAdded}, balance: ${newBalance}`);

      res.json({
        success: true,
        recharged: actualAdded,
        balance: newBalance,
        maxBalance,
      });
    } catch (error) {
      logger.error({ err: error }, '[HP] Recharge error');
      res.status(500).json({ error: "HP充值失败" });
    }
  });

  logger.info('[HPEconomy] Routes registered at /api/hp/*');
}
