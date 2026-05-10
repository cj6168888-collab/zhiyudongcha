import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { attachRole, requireMaster } from '../middleware/auth';

const logger = createServiceLogger('PsychProfileRoutes');

const MAX_IMAGE_SIZE = 7 * 1024 * 1024;

export function registerPsychProfileRoutes(app: Express, _context: RouteContext): void {
  app.get('/api/psych-profiles', attachRole, requireMaster, async (_req, res) => {
    try {
      const { psychProfilerService } = await import('../services/psych-profiler');
      const profiles = await psychProfilerService.getAllProfiles();
      res.json({ success: true, profiles, total: profiles.length });
    } catch (error) {
      logger.error({ err: error }, 'List profiles error');
      res.status(500).json({ error: '获取心理侧写列表失败' });
    }
  });

  app.get('/api/psych-profiles/:personId', attachRole, requireMaster, async (req, res) => {
    try {
      const { personId } = req.params;
      const { psychProfilerService } = await import('../services/psych-profiler');
      const profile = await psychProfilerService.getProfile(personId);

      if (!profile) {
        return res.status(404).json({ success: false, error: '该联系人暂无心理侧写' });
      }

      res.json({ success: true, profile });
    } catch (error) {
      logger.error({ err: error }, 'Get profile error');
      res.status(500).json({ error: '获取心理侧写失败' });
    }
  });

  app.post('/api/psych-profiles/analyze', attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64, personName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: '请提供照片' });
      }

      if (imageBase64.length > MAX_IMAGE_SIZE) {
        return res.status(400).json({ error: '图片过大' });
      }

      const { psychProfilerService } = await import('../services/psych-profiler');
      const result = await psychProfilerService.analyzeFromPhoto(imageBase64, personName);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Analyze error');
      res.status(500).json({ error: '心理分析失败' });
    }
  });

  app.post('/api/psych-profiles/:personId', attachRole, requireMaster, async (req, res) => {
    try {
      const { personId } = req.params;
      const { imageBase64, sourceType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: '请提供照片' });
      }

      if (imageBase64.length > MAX_IMAGE_SIZE) {
        return res.status(400).json({ error: '图片过大' });
      }

      const { psychProfilerService } = await import('../services/psych-profiler');
      const result = await psychProfilerService.createOrUpdateProfile(
        personId,
        imageBase64,
        sourceType || 'PHOTO'
      );

      if (result.success) {
        const profile = await psychProfilerService.getProfile(personId);
        res.json({ ...result, profile });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error({ err: error }, 'Create/Update profile error');
      res.status(500).json({ error: '创建心理侧写失败' });
    }
  });

  app.post('/api/psych-profiles/:personId/observation', attachRole, requireMaster, async (req, res) => {
    try {
      const { personId } = req.params;
      const { note, corrections } = req.body;

      if (!note) {
        return res.status(400).json({ error: '请提供观察备注' });
      }

      const { psychProfilerService } = await import('../services/psych-profiler');
      const result = await psychProfilerService.addObservationNote(personId, note, corrections);

      if (result.success) {
        const profile = await psychProfilerService.getProfile(personId);
        res.json({ ...result, profile });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error({ err: error }, 'Observation error');
      res.status(500).json({ error: '添加观察备注失败' });
    }
  });

  logger.info('PsychProfile routes registered');
}
