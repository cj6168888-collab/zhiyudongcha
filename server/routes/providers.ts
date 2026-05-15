/**
 * Provider API — P3
 * POST  /api/providers/omi/connect
 * POST  /api/providers/omi/import
 * GET   /api/providers/omi/status
 * POST  /api/providers/omi/disconnect
 */

import { Router, Request, Response } from 'express';
import { attachRole, requireMaster } from '../middleware/auth';
import { omiProvider, OmiExportPayload } from '../services/providers/OmiProvider';
import { createServiceLogger } from '../lib/logger';

const router = Router();
const logger = createServiceLogger('ProviderRoutes');

router.use(attachRole, requireMaster);

function getUserId(req: Request): string {
  return req.user?.id || 'default';
}

// ── Omi 连接配置 ─────────────────────────────────────

router.post('/omi/connect', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { apiKey, accountRef } = req.body;

    const state = await omiProvider.connect(ownerId, { apiKey, accountRef });
    res.json({ success: true, state });
  } catch (err) {
    logger.error('Omi connect failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ── Omi 批量导入 ─────────────────────────────────────

router.post('/omi/import', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const payload: OmiExportPayload = req.body;

    // 基本结构校验
    if (!payload || (typeof payload.memories === 'undefined' && typeof payload.conversations === 'undefined')) {
      res.status(400).json({
        success: false,
        error: 'Request body must contain at least one of: memories, conversations',
      });
      return;
    }

    const memoriesCount = (payload.memories ?? []).length;
    const conversationsCount = (payload.conversations ?? []).length;

    if (memoriesCount + conversationsCount === 0) {
      res.json({ success: true, result: { memoriesImported: 0, conversationsImported: 0, candidatesCreated: 0, errors: [], memoriesSkipped: 0, conversationsSkipped: 0 } });
      return;
    }

    logger.info({ ownerId, memoriesCount, conversationsCount }, 'Omi import started');
    const result = await omiProvider.importPayload(ownerId, payload);

    res.json({ success: true, result });
  } catch (err) {
    logger.error('Omi import failed', { err });
    // Omi 失败不影响主系统：返回 200 + 错误详情
    res.json({ success: false, error: 'Import failed', detail: String(err) });
  }
});

// ── Omi 同步状态 ─────────────────────────────────────

router.get('/omi/status', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const state = await omiProvider.getStatus(ownerId);

    res.json({
      success: true,
      connected: state !== null && state.status !== 'disconnected',
      state,
    });
  } catch (err) {
    logger.error('Omi status failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// ── Omi 断开连接 ─────────────────────────────────────

router.post('/omi/disconnect', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const ok = await omiProvider.disconnect(ownerId);

    res.json({ success: true, disconnected: ok });
  } catch (err) {
    logger.error('Omi disconnect failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export { router as providersRouter };
