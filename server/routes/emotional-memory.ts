/**
 * 情感记忆API路由 - 长时记忆层
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('EmotionalMemory');

import { Router } from 'express';
import { emotionalMemoryService } from '../services/emotional-memory';
import { z } from 'zod';
import { getErrorMessage } from '../lib/errors';

const router = Router();

const processConversationSchema = z.object({
  conversation: z.string().min(1),
  conversationId: z.string().optional(),
});

const searchMemoriesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10),
});

router.post('/process', async (req, res) => {
  try {
    const body = processConversationSchema.parse(req.body);
    const userRole = req.userRole || 'MASTER';
    const result = await emotionalMemoryService.processConversation(
      body.conversation,
      body.conversationId,
      userRole
    );
    
    res.json({
      success: true,
      entities: result.entities,
      memoriesStored: result.memoriesStored,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Process error');
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const memories = await emotionalMemoryService.getRecentMemories(days, limit);
    
    res.json({
      success: true,
      memories,
      count: memories.length,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Recent error');
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.post('/search', async (req, res) => {
  try {
    const body = searchMemoriesSchema.parse(req.body);
    const results = await emotionalMemoryService.searchSimilarMemories(
      body.query,
      body.limit
    );
    
    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Search error');
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

router.get('/context', async (req, res) => {
  try {
    const context = await emotionalMemoryService.getConversationContext();
    
    res.json({
      success: true,
      context,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Context error');
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.get('/proactive-care', async (req, res) => {
  try {
    const instructions = await emotionalMemoryService.getProactiveCareInstructions();
    
    res.json({
      success: true,
      instructions,
      count: instructions.length,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Proactive care error');
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await emotionalMemoryService.getMemoryStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stats error');
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

export default router;
logger.info('[EmotionalMemory] Routes registered at /api/memory/*');
