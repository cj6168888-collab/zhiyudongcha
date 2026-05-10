/**
 * P5 — Dream Review API
 * GET  /api/dream-review/latest
 * GET  /api/dream-review/history
 * GET  /api/dream-review/morning
 * POST /api/dream-review/run
 */
import { Router, Request, Response } from 'express';
import { attachRole } from '../middleware/auth';
import { dreamReviewService } from '../services/reflection/DreamReviewService';
import { morningBriefingService } from '../services/reflection/MorningBriefingService';
import { createServiceLogger } from '../lib/logger';

const router = Router();
const logger = createServiceLogger('DreamReviewRoutes');

router.use(attachRole);

function getUserId(req: Request): string {
  return req.user?.id || 'default';
}

// 最新复盘
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const review = await dreamReviewService.getLatestReview(ownerId);
    res.json({ success: true, review: review ?? null });
  } catch (err) {
    logger.error('Get latest review failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 复盘历史
router.get('/history', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const history = await dreamReviewService.getReviewHistory(ownerId, limit);
    res.json({ success: true, history });
  } catch (err) {
    logger.error('Get review history failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 晨间建议
router.get('/morning', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const briefing = await morningBriefingService.generateBriefing(ownerId);
    res.json({ success: true, briefing: briefing ?? null });
  } catch (err) {
    logger.error('Get morning briefing failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 手动触发复盘
router.post('/run', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { date } = req.body;

    // 校验日期格式（可选）
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, error: 'date must be in YYYY-MM-DD format' });
      return;
    }

    const result = await dreamReviewService.runReview(ownerId, date);

    if (!result) {
      res.json({ success: true, skipped: true, reason: 'No conversations to review' });
      return;
    }

    res.json({ success: true, skipped: false, result });
  } catch (err) {
    logger.error('Run dream review failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export { router as dreamReviewRouter };
