import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ActionPlugin } from '../plugins';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('useActionPlugin');

export interface ActionResult {
  /** true = intent was matched and executed (skip AI) */
  handled: boolean;
  /** Synthetic response text to show in chat */
  response: string;
  /** The matched action type */
  action?: 'make_call' | 'send_email' | 'add_calendar';
}

// ─── Intent Patterns ────────────────────────────────────────────────────────

const CALL_PATTERNS = [
  /(?:帮我?|请)?(?:拨打|打|呼叫)(?:电话)?(?:给|到)?\s*(.{1,20}?)(?:的电话|电话号码|号码)?(?:\s*(\d[\d\s\-]{6,14}))?$/u,
  /(?:拨号|呼叫)\s*[:：]?\s*(\d[\d\s\-]{6,14})/u,
];

const CALENDAR_PATTERNS = [
  /(?:添加|加入|新建|创建|记录)(?:一个?|个)?(?:日程|日历|提醒|活动|事件)[:：]?\s*(.{2,50})/u,
  /(?:提醒我|提醒一下)(?:在|于|明天|后天|今天|本周)?(?:\s+\d+[时点])?[\s,，]?\s*(.{2,50})/u,
  /(?:帮我把|把)\s*(.{2,30})\s*(?:加入|添加到|记到)(?:日历|日程|提醒)/u,
];

const EMAIL_PATTERNS = [
  /(?:发送?|寄|邮件)(?:邮件)?(?:给|到)\s*([^\s，,]{2,50}?)[\s,，]?(?:主题|标题)?[:：]?\s*(.{0,100})$/u,
];

// ─── Extractor Helpers ───────────────────────────────────────────────────────

function extractPhone(raw: string): string {
  const digits = raw.replace(/[\s\-()（）]/g, '');
  return /^\d{7,11}$/.test(digits) ? digits : raw.trim();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useActionPlugin() {
  const isNative = Capacitor.isNativePlatform();

  /**
   * Check the user message for direct device action intents.
   * Returns { handled: true, response, action } if matched.
   * Returns { handled: false, response: '' } if not a device action.
   */
  const detectAndExecute = useCallback(async (message: string): Promise<ActionResult> => {
    const msg = message.trim();

    // ── Phone call ──────────────────────────────────────────────────────────
    for (const pattern of CALL_PATTERNS) {
      const m = msg.match(pattern);
      if (m) {
        const target  = extractPhone(m[2] || m[1] || '');
        const display = m[1]?.trim() || target;

        if (!isNative) {
          return {
            handled:  true,
            action:   'make_call',
            response: `📞 拨号功能仅在手机端可用。号码：${target}`,
          };
        }

        try {
          await ActionPlugin.makeCall({ number: target });
          log.info('makeCall triggered', { target });
          return {
            handled:  true,
            action:   'make_call',
            response: `📞 正在为您拨打 ${display} 的电话…`,
          };
        } catch (err) {
          log.error('makeCall failed', err);
          return {
            handled:  true,
            action:   'make_call',
            response: `拨号失败，请手动拨打 ${target}。`,
          };
        }
      }
    }

    // ── Calendar ────────────────────────────────────────────────────────────
    for (const pattern of CALENDAR_PATTERNS) {
      const m = msg.match(pattern);
      if (m) {
        const title = (m[1] || '新日程').trim();

        if (!isNative) {
          return {
            handled:  true,
            action:   'add_calendar',
            response: `📅 日历功能仅在手机端可用。事项：${title}`,
          };
        }

        try {
          await ActionPlugin.addToCalendar({ title, startTime: Date.now() + 86_400_000 });
          log.info('addToCalendar triggered', { title });
          return {
            handled:  true,
            action:   'add_calendar',
            response: `📅 已打开日历，为您添加：「${title}」`,
          };
        } catch (err) {
          log.error('addToCalendar failed', err);
          return {
            handled:  true,
            action:   'add_calendar',
            response: `日历添加失败，请手动新建：「${title}」`,
          };
        }
      }
    }

    // ── Email ───────────────────────────────────────────────────────────────
    for (const pattern of EMAIL_PATTERNS) {
      const m = msg.match(pattern);
      if (m) {
        const to      = (m[1] || '').trim();
        const subject = (m[2] || '来自领航者的邮件').trim();

        if (!isNative) {
          return {
            handled:  true,
            action:   'send_email',
            response: `✉️ 邮件功能仅在手机端可用。收件人：${to}`,
          };
        }

        try {
          await ActionPlugin.sendEmailWithAttachment({ to, subject });
          log.info('sendEmailWithAttachment triggered', { to, subject });
          return {
            handled:  true,
            action:   'send_email',
            response: `✉️ 已打开邮件客户端，发送给 ${to}，主题：「${subject}」`,
          };
        } catch (err) {
          log.error('sendEmailWithAttachment failed', err);
          return {
            handled:  true,
            action:   'send_email',
            response: `邮件客户端启动失败，请手动发送给 ${to}。`,
          };
        }
      }
    }

    return { handled: false, response: '' };
  }, [isNative]);

  return { detectAndExecute };
}
