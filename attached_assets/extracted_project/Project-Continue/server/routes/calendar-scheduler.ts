/**
 * 小智 Calendar Scheduler Routes - 日程智能调度API
 * Project Guardian Angel (守护天使协议)
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router } from 'express';
import { calendarScheduler } from '../services/calendar-scheduler';
import { insertCalendarEventSchema, insertScheduleSettingSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

router.get('/settings', async (req, res) => {
  try {
    const settings = await calendarScheduler.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('[CalendarScheduler] 获取设置失败:', error);
    res.status(500).json({ success: false, error: '获取设置失败' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const data = insertScheduleSettingSchema.partial().parse(req.body);
    const settings = await calendarScheduler.updateSettings(data);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('[CalendarScheduler] 更新设置失败:', error);
    res.status(500).json({ success: false, error: '更新设置失败' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end ? new Date(end as string) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const events = await calendarScheduler.getEvents(startDate, endDate);
    res.json({ success: true, events });
  } catch (error) {
    console.error('[CalendarScheduler] 获取事件失败:', error);
    res.status(500).json({ success: false, error: '获取事件失败' });
  }
});

router.get('/events/:id', async (req, res) => {
  try {
    const event = await calendarScheduler.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: '事件不存在' });
    }
    res.json({ success: true, event });
  } catch (error) {
    console.error('[CalendarScheduler] 获取事件失败:', error);
    res.status(500).json({ success: false, error: '获取事件失败' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const rawData = req.body;
    
    const data = {
      ...rawData,
      startTime: new Date(rawData.startTime),
      endTime: new Date(rawData.endTime),
      recurrenceEndDate: rawData.recurrenceEndDate ? new Date(rawData.recurrenceEndDate) : undefined,
    };
    
    const parsed = insertCalendarEventSchema.parse(data);
    const result = await calendarScheduler.createEvent(parsed);
    
    if (result.conflict) {
      return res.status(409).json({ 
        success: false, 
        conflict: result.conflict,
        message: `日程冲突: ${result.conflict.conflictType}` 
      });
    }
    
    res.json({ success: true, event: result.event });
  } catch (error) {
    console.error('[CalendarScheduler] 创建事件失败:', error);
    res.status(500).json({ success: false, error: '创建事件失败' });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const rawData = req.body;
    
    const data: Record<string, any> = {};
    
    if (rawData.title !== undefined) data.title = rawData.title;
    if (rawData.description !== undefined) data.description = rawData.description;
    if (rawData.eventType !== undefined) data.eventType = rawData.eventType;
    if (rawData.priority !== undefined) data.priority = rawData.priority;
    if (rawData.isCompleted !== undefined) data.isCompleted = rawData.isCompleted;
    if (rawData.fatigueImpact !== undefined) data.fatigueImpact = rawData.fatigueImpact;
    if (rawData.energyRequired !== undefined) data.energyRequired = rawData.energyRequired;
    if (rawData.location !== undefined) data.location = rawData.location;
    if (rawData.attendees !== undefined) data.attendees = rawData.attendees;
    if (rawData.tags !== undefined) data.tags = rawData.tags;
    
    if (rawData.startTime) {
      const startDate = new Date(rawData.startTime);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ success: false, error: '无效的开始时间格式' });
      }
      data.startTime = startDate;
    }
    if (rawData.endTime) {
      const endDate = new Date(rawData.endTime);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ success: false, error: '无效的结束时间格式' });
      }
      data.endTime = endDate;
    }
    
    const validated = insertCalendarEventSchema.partial().parse(data);
    const event = await calendarScheduler.updateEvent(req.params.id, validated);
    if (!event) {
      return res.status(404).json({ success: false, error: '事件不存在' });
    }
    res.json({ success: true, event });
  } catch (error) {
    console.error('[CalendarScheduler] 更新事件失败:', error);
    res.status(500).json({ success: false, error: '更新事件失败' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await calendarScheduler.deleteEvent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[CalendarScheduler] 删除事件失败:', error);
    res.status(500).json({ success: false, error: '删除事件失败' });
  }
});

router.post('/insert-offline-blocks', async (req, res) => {
  try {
    const date = req.body.date ? new Date(req.body.date) : new Date();
    const events = await calendarScheduler.insertForcedOfflineBlocks(date);
    res.json({ success: true, inserted: events.length, events });
  } catch (error) {
    console.error('[CalendarScheduler] 插入离线时段失败:', error);
    res.status(500).json({ success: false, error: '插入离线时段失败' });
  }
});

router.post('/insert-rest-breaks', async (req, res) => {
  try {
    const date = req.body.date ? new Date(req.body.date) : new Date();
    const events = await calendarScheduler.insertRestBreaks(date);
    res.json({ success: true, inserted: events.length, events });
  } catch (error) {
    console.error('[CalendarScheduler] 插入休息时段失败:', error);
    res.status(500).json({ success: false, error: '插入休息时段失败' });
  }
});

router.get('/analyze/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const analysis = await calendarScheduler.analyzeDay(date);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('[CalendarScheduler] 分析日程失败:', error);
    res.status(500).json({ success: false, error: '分析日程失败' });
  }
});

router.get('/day-schedule/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const schedule = await calendarScheduler.getDaySchedule(date);
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('[CalendarScheduler] 获取日程失败:', error);
    res.status(500).json({ success: false, error: '获取日程失败' });
  }
});

router.post('/suggest-meeting-time', async (req, res) => {
  try {
    const { durationMinutes, preferredDate } = req.body;
    const duration = durationMinutes || 60;
    const date = preferredDate ? new Date(preferredDate) : undefined;
    
    const suggestions = await calendarScheduler.suggestOptimalMeetingTime(duration, date);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('[CalendarScheduler] 建议会议时间失败:', error);
    res.status(500).json({ success: false, error: '建议会议时间失败' });
  }
});

export default router;
