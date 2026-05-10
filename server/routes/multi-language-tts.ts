/**
 * 多语言 TTS API 路由
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { multiLanguageTTS } from '../services/multi-language-tts';
import { multiLanguageService, LanguageCode } from '../services/multi-language';

const logger = createServiceLogger('MultiLanguageTTSRoutes');
const router = Router();

const synthesizeSchema = z.object({
  text: z.string().min(1),
  language: z.enum(['zh-CN', 'en-US', 'yue']).optional(),
  voice: z.string().optional(),
  speed: z.number().min(-50).max(50).optional(),
  pitch: z.number().min(-50).max(50).optional(),
});

/**
 * GET /api/tts/voices
 * 获取可用语音列表
 */
router.get('/voices', async (req: Request, res: Response) => {
  try {
    const voices = multiLanguageTTS.getAvailableVoices();
    
    res.json({
      success: true,
      voices,
    });
  } catch (error) {
    logger.error({ err: error }, '获取语音列表失败');
    res.status(500).json({ success: false, error: '获取语音列表失败' });
  }
});

/**
 * POST /api/tts/synthesize
 * 合成语音
 */
router.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const body = synthesizeSchema.parse(req.body);
    
    const result = await multiLanguageTTS.synthesize({
      text: body.text,
      language: body.language,
      voice: body.voice,
      speed: body.speed,
      pitch: body.pitch,
    });
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error({ err: error }, '语音合成失败');
    res.status(500).json({ success: false, error: '语音合成失败' });
  }
});

/**
 * POST /api/tts/detect-and-synthesize
 * 自动检测语言并合成语音
 */
router.post('/detect-and-synthesize', async (req: Request, res: Response) => {
  try {
    const { text, voice, speed, pitch } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    
    // 自动检测语言
    const detectedLang = multiLanguageService.detectLanguage(text);
    
    const result = await multiLanguageTTS.synthesize({
      text,
      language: detectedLang,
      voice,
      speed,
      pitch,
    });
    
    res.json({
      success: true,
      ...result,
      detectedLanguage: detectedLang,
    });
  } catch (error) {
    logger.error({ err: error }, '语音合成失败');
    res.status(500).json({ success: false, error: '语音合成失败' });
  }
});

export default router;
