/**
 * 小智 Capability Indexer Routes - 团队能力索引API
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('CapabilityIndexer');

import { Router } from 'express';
import { requireMaster } from '../middleware/auth';
import { capabilityIndexer } from '../services/capability-indexer';
import { z } from 'zod';
import { getErrorMessage } from '../lib/errors';

const router = Router();

router.get('/overview', requireMaster, async (req, res) => {
  try {
    const overview = await capabilityIndexer.getTeamCapabilityOverview();
    res.json({ success: true, ...overview });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) || '获取能力概览失败' });
  }
});

router.get('/search', requireMaster, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: '缺少搜索关键词' });
    }
    
    const results = await capabilityIndexer.searchByCapability(q);
    res.json({ success: true, results });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) || '搜索失败' });
  }
});

router.post('/index/:personId', requireMaster, async (req, res) => {
  try {
    const { personId } = req.params;
    await capabilityIndexer.indexPerson(personId);
    res.json({ success: true, message: '能力索引已更新' });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) || '索引失败' });
  }
});

router.post('/index-all', requireMaster, async (req, res) => {
  try {
    const result = await capabilityIndexer.indexAllPersons();
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) || '批量索引失败' });
  }
});

const matchSchema = z.object({
  capabilities: z.array(z.string()).min(1),
});

router.post('/match', requireMaster, async (req, res) => {
  try {
    const validation = matchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: '参数无效' });
    }
    
    const { capabilities } = validation.data;
    const results = await capabilityIndexer.findPersonsWithCapabilities(capabilities);
    res.json({ success: true, results });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) || '匹配失败' });
  }
});

export default router;
