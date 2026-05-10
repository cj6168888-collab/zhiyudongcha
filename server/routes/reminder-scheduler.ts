/**
 * Smart Reminder Scheduler API Routes - Phase 2.2
 * 智能提醒调度器 API 端点
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ReminderScheduler');

import { Router } from 'express';
import { reminderScheduler, RuleType, ReminderStatus } from '../services/reminder-scheduler';
import { insertReminderRuleSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

interface TriggerConfig {
  targetDate?: string;
  recurrence?: string;
  [key: string]: unknown;
}

router.get('/rules', async (req, res) => {
  try {
    const { enabled, ruleType, entityType, entityId } = req.query;
    
    const rules = await reminderScheduler.getRules({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      ruleType: ruleType as RuleType | undefined,
      entityType: entityType as string,
      entityId: entityId as string,
    });
    
    res.json({ success: true, rules });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get rules error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const validatedData = insertReminderRuleSchema.parse(req.body);
    
    const triggerType = validatedData.triggerType || 'TIME';
    const triggerConfig = (validatedData.triggerConfig as TriggerConfig) || {};
    
    if (triggerType === 'TIME' && !validatedData.nextTriggerAt && !triggerConfig.targetDate && !triggerConfig.recurrence) {
      return res.status(400).json({ 
        success: false, 
        error: 'Time-based rules require nextTriggerAt, triggerConfig.targetDate, or triggerConfig.recurrence' 
      });
    }
    
    const rule = await reminderScheduler.createRule(validatedData);
    
    res.json({ success: true, rule });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create rule error');
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  }
});

router.patch('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await reminderScheduler.updateRule(id, req.body);
    
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    res.json({ success: true, rule });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update rule error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await reminderScheduler.deleteRule(id);
    
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete rule error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/rules/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    const rule = await reminderScheduler.toggleRule(id, enabled);
    
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    res.json({ success: true, rule });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Toggle rule error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/calendar/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { advanceMinutes = 15 } = req.body;
    
    const rule = await reminderScheduler.createCalendarReminder(eventId, advanceMinutes);
    
    res.json({ success: true, rule });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create calendar reminder error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { ruleId, status, limit } = req.query;
    
    const logs = await reminderScheduler.getReminderLogs({
      ruleId: ruleId as string,
      status: status as ReminderStatus | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({ success: true, logs });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get logs error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/logs/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await reminderScheduler.markReminderRead(id);
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    
    res.json({ success: true, log });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Mark read error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/logs/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await reminderScheduler.dismissReminder(id);
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    
    res.json({ success: true, log });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Dismiss error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/logs/:id/snooze', async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes = 15 } = req.body;
    
    const log = await reminderScheduler.snoozeReminder(id, minutes);
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    
    res.json({ success: true, log });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Snooze error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/process', async (req, res) => {
  try {
    const triggered = await reminderScheduler.processReminders();
    
    res.json({ 
      success: true, 
      triggered: triggered.length,
      reminders: triggered 
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Process error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await reminderScheduler.getStats();
    
    res.json({ success: true, stats });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stats error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
