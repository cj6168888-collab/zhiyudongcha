import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireAuth, requireMaster } from '../middleware/auth';
import { hpService } from '../services/HPService';

const logger = createServiceLogger('HPRoutes');

function isInsufficientHPError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('HP') && (
    error.message.includes('不足') ||
    error.message.includes('涓嶈冻') ||
    error.message.toLowerCase().includes('insufficient')
  );
}

function isMissingServiceTypeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('服务类型') ||
    error.message.includes('鏈嶅姟绫诲瀷') ||
    error.message.toLowerCase().includes('service type')
  );
}

export function registerHPRoutes(app: Express, _context: RouteContext): void {
  app.get('/api/z1/hp', async (_req, res) => {
    try {
      const status = await hpService.getHPStatus();
      return res.json(status);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get HP');
      return res.status(500).json({ error: 'Failed to get HP' });
    }
  });

  app.post('/api/z1/hp/consume', async (req, res) => {
    try {
      const { amount, reason } = req.body;
      const actor = req.userRole || 'SYSTEM';

      const result = await hpService.consumeHP(amount, reason, actor);
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to consume HP');
      if (isInsufficientHPError(error)) {
        return res.status(402).json({ error: (error as Error).message });
      }
      return res.status(500).json({ error: 'Failed to consume HP' });
    }
  });

  app.post('/api/z1/hp/restore', requireMaster, async (req, res) => {
    try {
      const { amount } = req.body;

      const result = await hpService.restoreHP(amount, 'MASTER');
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to restore HP');
      return res.status(500).json({ error: 'Failed to restore HP' });
    }
  });

  app.get('/api/hp/balance', requireAuth, async (_req, res) => {
    try {
      const hpBalance = await hpService.getHPBalance();
      return res.json({
        success: true,
        data: hpBalance,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get HP balance');
      return res.status(500).json({ error: 'Failed to get HP balance' });
    }
  });

  app.post('/api/hp/consume', requireAuth, async (req, res) => {
    try {
      const { amount, serviceType, description, metadata } = req.body;
      const actor = req.userRole || 'SYSTEM';

      const result = await hpService.consumeHPForService(
        amount,
        serviceType,
        description,
        metadata,
        actor,
      );
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to consume HP');
      if (isInsufficientHPError(error)) {
        return res.status(402).json({ error: (error as Error).message });
      }
      if (isMissingServiceTypeError(error)) {
        return res.status(400).json({ error: (error as Error).message });
      }
      return res.status(500).json({ error: 'Failed to consume HP' });
    }
  });

  app.post('/api/hp/recharge', requireMaster, async (req, res) => {
    try {
      const { amount, source, description } = req.body;
      const actor = req.userRole || 'MASTER';

      const result = await hpService.rechargeHP(amount, source, description, actor);
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to recharge HP');
      return res.status(500).json({ error: 'Failed to recharge HP' });
    }
  });

  logger.info('HP routes registered');
}
