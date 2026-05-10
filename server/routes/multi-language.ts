/**
 * 多语言 API 路由
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { multiLanguageService, LanguageCode } from '../services/multi-language';

const logger = createServiceLogger('MultiLanguageRoutes');
const router = Router();

const detectSchema = z.object({
  text: z.string().min(1),
});

/**
 * GET /api/i18n/languages
 * 获取支持的语言列表
 */
router.get('/languages', async (req: Request, res: Response) => {
  try {
    const languages = multiLanguageService.getSupportedLanguages();
    const defaultLang = multiLanguageService.getDefaultLanguage();
    
    res.json({
      success: true,
      languages,
      default: defaultLang,
    });
  } catch (error) {
    logger.error({ err: error }, '获取语言列表失败');
    res.status(500).json({ success: false, error: '获取语言列表失败' });
  }
});

/**
 * GET /api/i18n/config/:language
 * 获取指定语言配置
 */
router.get('/config/:language', async (req: Request, res: Response) => {
  try {
    const { language } = req.params as { language: LanguageCode };
    
    const config = multiLanguageService.getConfig(language);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: '不支持该语言',
      });
    }
    
    res.json({
      success: true,
      language,
      config,
    });
  } catch (error) {
    logger.error({ err: error }, '获取语言配置失败');
    res.status(500).json({ success: false, error: '获取语言配置失败' });
  }
});

/**
 * POST /api/i18n/detect
 * 检测文本语言
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const body = detectSchema.parse(req.body);
    
    const detected = multiLanguageService.detectLanguage(body.text);
    
    res.json({
      success: true,
      text: body.text,
      detected,
    });
  } catch (error) {
    logger.error({ err: error }, '语言检测失败');
    res.status(500).json({ success: false, error: '语言检测失败' });
  }
});

/**
 * POST /api/i18n/check-wakeword
 * 检查是否是唤醒词
 */
router.post('/check-wakeword', async (req: Request, res: Response) => {
  try {
    const { text, language } = req.body;
    
    const isWakeWord = multiLanguageService.isWakeWord(text, language);
    
    res.json({
      success: true,
      text,
      isWakeWord,
      language: language || multiLanguageService.getDefaultLanguage(),
    });
  } catch (error) {
    logger.error({ err: error }, '唤醒词检查失败');
    res.status(500).json({ success: false, error: '唤醒词检查失败' });
  }
});

/**
 * POST /api/i18n/match-command
 * 匹配命令类型
 */
router.post('/match-command', async (req: Request, res: Response) => {
  try {
    const { text, language } = req.body;
    
    const commandType = multiLanguageService.matchCommandType(text, language);
    const keywordType = multiLanguageService.getKeywordType(text, language);
    
    res.json({
      success: true,
      text,
      commandType,
      keywordType,
      language: language || multiLanguageService.getDefaultLanguage(),
    });
  } catch (error) {
    logger.error({ err: error }, '命令匹配失败');
    res.status(500).json({ success: false, error: '命令匹配失败' });
  }
});

/**
 * PUT /api/i18n/default
 * 设置默认语言
 */
router.put('/default', async (req: Request, res: Response) => {
  try {
    const { language } = req.body as { language: LanguageCode };
    
    multiLanguageService.setDefaultLanguage(language);
    
    res.json({
      success: true,
      default: language,
    });
  } catch (error) {
    logger.error({ err: error }, '设置默认语言失败');
    res.status(500).json({ success: false, error: '设置默认语言失败' });
  }
});

export default router;
