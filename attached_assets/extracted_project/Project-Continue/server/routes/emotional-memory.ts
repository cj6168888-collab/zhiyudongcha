/**
 * 情感记忆API路由 - 长时记忆层
 */

import { Router } from 'express';
import { emotionalMemoryService } from '../services/emotional-memory';
import { z } from 'zod';

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
  } catch (error: any) {
    console.error('[EmotionalMemory API] Process error:', error);
    res.status(400).json({ error: error.message });
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
  } catch (error: any) {
    console.error('[EmotionalMemory API] Recent error:', error);
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    console.error('[EmotionalMemory API] Search error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/context', async (req, res) => {
  try {
    const context = await emotionalMemoryService.getConversationContext();
    
    res.json({
      success: true,
      context,
    });
  } catch (error: any) {
    console.error('[EmotionalMemory API] Context error:', error);
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    console.error('[EmotionalMemory API] Proactive care error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await emotionalMemoryService.getMemoryStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[EmotionalMemory API] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
console.log('[EmotionalMemory] Routes registered at /api/memory/*');
