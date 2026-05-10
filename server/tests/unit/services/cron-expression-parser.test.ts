import { describe, it, expect } from 'vitest';
import {
  parseCronFromText,
  hasRecurringPattern,
  extractTaskNameFromRecurring,
} from '../../../services/assistant/CronExpressionParser';

// ── parseCronFromText ──────────────────────────────────────

describe('parseCronFromText — 每周', () => {
  it('每周一 → 0 9 * * 1', () => {
    expect(parseCronFromText('每周一提醒我整理项目战报')?.expression).toBe('0 9 * * 1');
  });

  it('每周五下午3点 → 0 15 * * 5', () => {
    const p = parseCronFromText('每周五下午3点发报告');
    expect(p?.expression).toBe('0 15 * * 5');
  });

  it('每个星期三早上9点 → 0 9 * * 3', () => {
    expect(parseCronFromText('每个星期三早上9点同步进度')?.expression).toBe('0 9 * * 3');
  });

  it('每周日 → 0 9 * * 0', () => {
    const p = parseCronFromText('每周日回顾本周');
    expect(p?.expression).toBe('0 9 * * 0');
  });

  it('humanReadable 含星期名', () => {
    expect(parseCronFromText('每周一整理战报')?.humanReadable).toContain('周一');
  });
});

describe('parseCronFromText — 每天', () => {
  it('每天早上9点 → 0 9 * * *', () => {
    expect(parseCronFromText('每天早上9点发日报')?.expression).toBe('0 9 * * *');
  });

  it('每天晚上8点 → 0 20 * * *', () => {
    expect(parseCronFromText('每天晚上8点复盘')?.expression).toBe('0 20 * * *');
  });

  it('每日 → 默认 9点', () => {
    expect(parseCronFromText('每日同步数据')?.expression).toBe('0 9 * * *');
  });
});

describe('parseCronFromText — 每月', () => {
  it('每月1号 → 0 9 1 * *', () => {
    expect(parseCronFromText('每月1号生成月报')?.expression).toBe('0 9 1 * *');
  });

  it('每月15日下午2点 → 0 14 15 * *', () => {
    expect(parseCronFromText('每月15日下午2点结算')?.expression).toBe('0 14 15 * *');
  });
});

describe('parseCronFromText — 工作日', () => {
  it('工作日 → 0 9 * * 1-5', () => {
    expect(parseCronFromText('工作日早上9点打卡')?.expression).toBe('0 9 * * 1-5');
  });
});

describe('parseCronFromText — 分钟级', () => {
  it('每小时 → 0 * * * *', () => {
    expect(parseCronFromText('每小时同步状态')?.expression).toBe('0 * * * *');
  });

  it('每5分钟 → */5 * * * *', () => {
    expect(parseCronFromText('每5分钟检查邮件')?.expression).toBe('*/5 * * * *');
  });

  it('每30分钟 → */30 * * * *', () => {
    expect(parseCronFromText('每30分钟刷新数据')?.expression).toBe('*/30 * * * *');
  });
});

describe('parseCronFromText — 非循环', () => {
  it('普通任务返回 null', () => {
    expect(parseCronFromText('创建一个新任务')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(parseCronFromText('')).toBeNull();
  });
});

// ── hasRecurringPattern ───────────────────────────────────

describe('hasRecurringPattern', () => {
  it.each([
    '每周一提醒我整理战报',
    '每天早上发日报',
    '每月1号结算',
    '工作日打卡',
    '每小时检查',
    '每5分钟刷新',
    '每个早上做计划',
  ])('识别循环语义: %s', (text) => {
    expect(hasRecurringPattern(text)).toBe(true);
  });

  it.each([
    '创建一个新任务',
    '帮我记住今天的会议',
    '新建项目计划书',
  ])('不误判普通语句: %s', (text) => {
    expect(hasRecurringPattern(text)).toBe(false);
  });
});

// ── extractTaskNameFromRecurring ──────────────────────────

describe('extractTaskNameFromRecurring', () => {
  it('每周一提醒我整理项目战报 → 整理项目战报', () => {
    const name = extractTaskNameFromRecurring('每周一提醒我整理项目战报');
    expect(name).toBe('整理项目战报');
  });

  it('每天早上9点发送日报 → 发送日报', () => {
    const name = extractTaskNameFromRecurring('每天早上9点发送日报');
    expect(name).toContain('发送日报');
  });

  it('每月1号生成月报 → 生成月报', () => {
    const name = extractTaskNameFromRecurring('每月1号生成月报');
    expect(name).toContain('月报');
  });

  it('空结果时返回默认名称', () => {
    const name = extractTaskNameFromRecurring('每天');
    expect(name.length).toBeGreaterThan(0);
  });
});
