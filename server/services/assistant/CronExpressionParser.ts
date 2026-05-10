// CronExpressionParser — 中文自然语言循环时间 → cron 表达式
// 支持：
//   每天/每日/每早/每晚  →  0 H * * *
//   每周[一~日]         →  0 H * * DOW
//   每月[N号]           →  0 H N * *
//   工作日              →  0 H * * 1-5
//   每小时              →  0 * * * *
//   每N分钟             →  star/N * * * *  (实际输出 */N)

export interface ParsedCron {
  expression: string;
  timezone: string;
  humanReadable: string;
}

const DEFAULT_TZ = 'Asia/Shanghai';

// 星期映射
const DOW_MAP: Record<string, number> = {
  一: 1, '1': 1, 周一: 1, 星期一: 1, Monday: 1,
  二: 2, '2': 2, 周二: 2, 星期二: 2, Tuesday: 2,
  三: 3, '3': 3, 周三: 3, 星期三: 3, Wednesday: 3,
  四: 4, '4': 4, 周四: 4, 星期四: 4, Thursday: 4,
  五: 5, '5': 5, 周五: 5, 星期五: 5, Friday: 5,
  六: 6, '6': 6, 周六: 6, 星期六: 6, Saturday: 6,
  日: 0, '0': 0, 天: 0, 周日: 0, 周天: 0, 星期日: 0, 星期天: 0, Sunday: 0,
};

// 时段默认小时
const PERIOD_HOUR: Record<string, number> = {
  凌晨: 3,
  早上: 9,
  上午: 9,
  中午: 12,
  下午: 14,
  傍晚: 17,
  晚上: 20,
  夜: 21,
  夜晚: 21,
};

/** 从文本中提取小时数（0-23），找不到返回 defaultHour */
function extractHour(text: string, defaultHour = 9): number {
  // 时段词
  for (const [period, h] of Object.entries(PERIOD_HOUR)) {
    if (text.includes(period)) {
      // 看时段后有没有 X 点
      const after = text.slice(text.indexOf(period) + period.length);
      const explicit = after.match(/(\d{1,2})[点:：时]/);
      if (explicit) {
        const h2 = parseInt(explicit[1], 10);
        // 下午/晚上若 < 12 则 +12
        if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '夜' || period === '夜晚') && h2 < 12) {
          return h2 + 12;
        }
        return h2;
      }
      return h;
    }
  }
  // 无时段词，直接找 X 点
  const m = text.match(/(\d{1,2})[点:：时]/);
  if (m) return parseInt(m[1], 10);
  return defaultHour;
}

/**
 * 尝试将文本解析为 cron 表达式。
 * 返回 null 表示不是循环任务语义。
 */
export function parseCronFromText(text: string): ParsedCron | null {
  const t = text.trim();

  // ── 每N分钟 ──────────────────────────────────────────────
  const everyMin = t.match(/每(\d+)分钟/);
  if (everyMin) {
    const n = parseInt(everyMin[1], 10);
    return {
      expression: `*/${n} * * * *`,
      timezone: DEFAULT_TZ,
      humanReadable: `每 ${n} 分钟`,
    };
  }

  // ── 每小时 ────────────────────────────────────────────────
  if (/每小时/.test(t)) {
    return {
      expression: '0 * * * *',
      timezone: DEFAULT_TZ,
      humanReadable: '每小时',
    };
  }

  // ── 工作日 ────────────────────────────────────────────────
  if (/工作日|每个工作日/.test(t)) {
    const hour = extractHour(t);
    return {
      expression: `0 ${hour} * * 1-5`,
      timezone: DEFAULT_TZ,
      humanReadable: `每工作日 ${hour}:00`,
    };
  }

  // ── 每周X ─────────────────────────────────────────────────
  const weekMatch = t.match(/每周([一二三四五六日天1-7])|每个?星期([一二三四五六日天1-7])/);
  if (weekMatch) {
    const raw = weekMatch[1] || weekMatch[2];
    const dow = DOW_MAP[raw] ?? 1;
    const hour = extractHour(t);
    const dowNames = ['日', '一', '二', '三', '四', '五', '六'];
    return {
      expression: `0 ${hour} * * ${dow}`,
      timezone: DEFAULT_TZ,
      humanReadable: `每周${dowNames[dow]} ${hour}:00`,
    };
  }

  // ── 每月N号 ───────────────────────────────────────────────
  const monthMatch = t.match(/每月(\d{1,2})(?:号|日)/);
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const hour = extractHour(t);
    return {
      expression: `0 ${hour} ${day} * *`,
      timezone: DEFAULT_TZ,
      humanReadable: `每月 ${day} 号 ${hour}:00`,
    };
  }

  // ── 每天 ─────────────────────────────────────────────────
  if (/每天|每日|每晚|每早|每个?早上|每个?晚上/.test(t)) {
    const hour = extractHour(t);
    return {
      expression: `0 ${hour} * * *`,
      timezone: DEFAULT_TZ,
      humanReadable: `每天 ${hour}:00`,
    };
  }

  return null;
}

/**
 * 判断文本是否含有循环任务语义（用于快速过滤）。
 */
export function hasRecurringPattern(text: string): boolean {
  return /每天|每日|每周|每月|每小时|每\d+分钟|工作日|每个?早上|每个?晚上|每个?星期/.test(text);
}

/**
 * 从循环任务语句中提取任务名称。
 * 例："每周一提醒我整理项目战报" → "整理项目战报"
 *      "每天早上9点发送日报"     → "发送日报"
 */
export function extractTaskNameFromRecurring(text: string): string {
  return text
    // 去掉循环时间前缀
    .replace(/每(天|日|周[一二三四五六日天]|月\d{1,2}[号日]|小时|\d+分钟|个?早上|个?晚上|个?星期[一二三四五六日天])/u, '')
    // 去掉时段词
    .replace(/[早上午|上午|中午|下午|傍晚|晚上|夜|夜晚|凌晨]?\s*\d{0,2}[点:：时]?\s*/u, '')
    // 去掉动词前缀
    .replace(/^(提醒我|提醒|帮我|自动|定时|按时|每次|)?\s*/u, '')
    .replace(/[，。！!?？\s]+$/u, '')
    .trim() || '循环任务';
}
