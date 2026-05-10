/**
 * P4 — Screen Awareness API
 * GET  /api/screen-awareness/status
 * POST /api/screen-awareness/enable
 * POST /api/screen-awareness/disable
 * POST /api/screen-awareness/capture
 */
import { Router, Request, Response } from 'express';
import { attachRole } from '../middleware/auth';
import { screenAwarenessBridge } from '../services/screen/ScreenAwarenessBridge';
import { createServiceLogger } from '../lib/logger';

const router = Router();
const logger = createServiceLogger('ScreenAwarenessRoutes');

router.use(attachRole);

function getUserId(req: Request): string {
  return req.user?.id || 'default';
}

router.get('/status', (req: Request, res: Response) => {
  const ownerId = getUserId(req);
  res.json({ success: true, enabled: screenAwarenessBridge.isEnabled(ownerId) });
});

router.post('/enable', (req: Request, res: Response) => {
  const ownerId = getUserId(req);
  screenAwarenessBridge.enable(ownerId);
  res.json({ success: true, enabled: true });
});

router.post('/disable', (req: Request, res: Response) => {
  const ownerId = getUserId(req);
  screenAwarenessBridge.disable(ownerId);
  res.json({ success: true, enabled: false });
});

router.post('/capture', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { text, appContext, source } = req.body;

    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ success: false, error: 'text is required' });
      return;
    }

    const result = await screenAwarenessBridge.processCapture(ownerId, {
      text,
      appContext,
      source,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Capture endpoint failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export { router as screenAwarenessRouter };
