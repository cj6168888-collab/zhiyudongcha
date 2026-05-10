/**
 * Smart Reminder Scheduler API Routes - Phase 2.2
 * 智能提醒调度器 API 端点
 */

import { Router } from 'express';
import { reminderScheduler } from '../services/reminder-scheduler';
import { insertReminderRuleSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

router.get('/rules', async (req, res) => {
  try {
    const { enabled, ruleType, entityType, entityId } = req.query;
    
    const rules = await reminderScheduler.getRules({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      ruleType: ruleType as any,
      entityType: entityType as string,
      entityId: entityId as string,
    });
    
    res.json({ success: true, rules });
  } catch (error: any) {
    console.error('[ReminderAPI] Get rules error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const validatedData = insertReminderRuleSchema.parse(req.body);
    
    const triggerType = validatedData.triggerType || 'TIME';
    const triggerConfig = validatedData.triggerConfig as any || {};
    
    if (triggerType === 'TIME' && !validatedData.nextTriggerAt && !triggerConfig.targetDate && !triggerConfig.recurrence) {
      return res.status(400).json({ 
        success: false, 
        error: 'Time-based rules require nextTriggerAt, triggerConfig.targetDate, or triggerConfig.recurrence' 
      });
    }
    
    const rule = await reminderScheduler.createRule(validatedData);
    
    res.json({ success: true, rule });
  } catch (error: any) {
    console.error('[ReminderAPI] Create rule error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ReminderAPI] Update rule error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await reminderScheduler.deleteRule(id);
    
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    console.error('[ReminderAPI] Delete rule error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ReminderAPI] Toggle rule error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/calendar/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { advanceMinutes = 15 } = req.body;
    
    const rule = await reminderScheduler.createCalendarReminder(eventId, advanceMinutes);
    
    res.json({ success: true, rule });
  } catch (error: any) {
    console.error('[ReminderAPI] Create calendar reminder error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { ruleId, status, limit } = req.query;
    
    const logs = await reminderScheduler.getReminderLogs({
      ruleId: ruleId as string,
      status: status as any,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({ success: true, logs });
  } catch (error: any) {
    console.error('[ReminderAPI] Get logs error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ReminderAPI] Mark read error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ReminderAPI] Dismiss error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ReminderAPI] Snooze error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ReminderAPI] Process error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await reminderScheduler.getStats();
    
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[ReminderAPI] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
