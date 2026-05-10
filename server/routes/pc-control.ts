/**
 * PC控制 API 路由
 * 
 * 提供PC端自动化控制的REST API
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { pcExecutorService } from '../services/mobile';

const logger = createServiceLogger('PCControlRoutes');

const router = Router();

const clickSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  clicks: z.number().min(1).max(10).optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
});

const moveSchema = z.object({
  x: z.number(),
  y: z.number(),
  duration: z.number().min(0).max(10).optional(),
});

const dragSchema = z.object({
  startX: z.number(),
  startY: z.number(),
  endX: z.number(),
  endY: z.number(),
  duration: z.number().min(0).max(10).optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
});

const typeSchema = z.object({
  text: z.string().max(10000),
  interval: z.number().min(0).max(1).optional(),
});

const pressSchema = z.object({
  keys: z.union([z.string(), z.array(z.string())]),
});

const hotkeySchema = z.object({
  keys: z.array(z.string()).min(1),
});

const scrollSchema = z.object({
  clicks: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const screenshotSchema = z.object({
  path: z.string().optional(),
  region: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

const locateSchema = z.object({
  imagePath: z.string(),
  confidence: z.number().min(0.1).max(1).optional(),
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const isAvailable = pcExecutorService.isReady();
    const version = isAvailable ? pcExecutorService.getPythonVersion() : null;

    res.json({
      success: true,
      data: {
        available: isAvailable,
        pythonVersion: version,
        platform: process.platform,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get PC executor status');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

router.post('/click', async (req: Request, res: Response) => {
  try {
    const body = clickSchema.parse(req.body);

    const result = await pcExecutorService.click(
      body.x,
      body.y,
      body.clicks,
      body.button
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to click');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to click',
    });
  }
});

router.post('/double-click', async (req: Request, res: Response) => {
  try {
    const { x, y } = req.body;

    const result = await pcExecutorService.doubleClick(x, y);

    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to double click');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to double click',
    });
  }
});

router.post('/right-click', async (req: Request, res: Response) => {
  try {
    const { x, y } = req.body;

    const result = await pcExecutorService.rightClick(x, y);

    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to right click');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to right click',
    });
  }
});

router.post('/move-to', async (req: Request, res: Response) => {
  try {
    const body = moveSchema.parse(req.body);

    const result = await pcExecutorService.moveTo(
      body.x,
      body.y,
      body.duration
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to move mouse');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to move mouse',
    });
  }
});

router.post('/drag-to', async (req: Request, res: Response) => {
  try {
    const body = dragSchema.parse(req.body);

    const result = await pcExecutorService.dragTo(
      body.startX,
      body.startY,
      body.endX,
      body.endY,
      body.duration
    );

    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to drag');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to drag',
    });
  }
});

router.post('/type', async (req: Request, res: Response) => {
  try {
    const body = typeSchema.parse(req.body);

    const result = await pcExecutorService.type(
      body.text,
      body.interval
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to type');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to type',
    });
  }
});

router.post('/press', async (req: Request, res: Response) => {
  try {
    const body = pressSchema.parse(req.body);

    const keys = Array.isArray(body.keys) ? body.keys : [body.keys];
    const result = await pcExecutorService.press(keys);

    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to press key');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to press key',
    });
  }
});

router.post('/hotkey', async (req: Request, res: Response) => {
  try {
    const body = hotkeySchema.parse(req.body);

    const result = await pcExecutorService.hotkey(...body.keys);

    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to execute hotkey');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute hotkey',
    });
  }
});

router.post('/scroll', async (req: Request, res: Response) => {
  try {
    const body = scrollSchema.parse(req.body);

    const result = await pcExecutorService.scroll(
      body.clicks,
      body.x,
      body.y
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to scroll');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scroll',
    });
  }
});

router.post('/screenshot', async (req: Request, res: Response) => {
  try {
    const body = screenshotSchema.parse(req.body);

    const result = await pcExecutorService.screenshot({
      path: body.path,
      region: body.region ? {
        0: body.region[0],
        1: body.region[1],
        2: body.region[2],
        3: body.region[3],
      } : undefined,
    });

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to take screenshot');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to take screenshot',
    });
  }
});

router.post('/locate', async (req: Request, res: Response) => {
  try {
    const body = locateSchema.parse(req.body);

    const result = await pcExecutorService.locateOnScreen(
      body.imagePath,
      body.confidence
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to locate on screen');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to locate on screen',
    });
  }
});

router.post('/alert', async (req: Request, res: Response) => {
  try {
    const { text, title } = req.body;

    const result = await pcExecutorService.alert(text || 'Alert', title);

    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to show alert');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to show alert',
    });
  }
});

router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { text, title, buttons } = req.body;

    const result = await pcExecutorService.confirm(
      text || 'Confirm?',
      title || 'Confirm',
      buttons || ['OK', 'Cancel']
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to show confirm');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to show confirm',
    });
  }
});

router.post('/prompt', async (req: Request, res: Response) => {
  try {
    const { text, title, default: defaultText } = req.body;

    const result = await pcExecutorService.prompt(
      text || 'Enter value:',
      title || 'Input',
      defaultText
    );

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to show prompt');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to show prompt',
    });
  }
});

export default router;
