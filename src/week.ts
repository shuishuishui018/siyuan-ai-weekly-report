import { DEFAULT_TITLE_TEMPLATE, type RangeMode } from "./types";

export interface DateRange {
  start: Date;
  end: Date;
  isoYear: number;
  isoWeek: number;
  label: string;
}

const DAY_MS = 86400000;

export function startOfDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(23, 59, 59, 0);
  return x;
}

/** ISO 8601 周序号（周一为一周第一天） */
export function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return d;
}

export function formatCn(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 结束日相对开始日化简：同年同月 → D日；同年不同月 → M月D日；跨年 → YYYY年M月D日 */
export function formatCnEnd(start: Date, end: Date): string {
  if (start.getFullYear() !== end.getFullYear()) {
    return formatCn(end);
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${end.getMonth() + 1}月${end.getDate()}日`;
  }
  return `${end.getDate()}日`;
}

/** 转为思源 SQL 中 updated/created 字段使用的 YYYYMMDDHHMMSS 文本 */
export function toSiyuanTime(date: Date, endOfDayFlag = false): string {
  const d = endOfDayFlag ? endOfDay(date) : startOfDay(date);
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function parseIsoDate(text: string): Date | null {
  if (!text) {
    return null;
  }
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveRange(
  mode: RangeMode,
  lastNDays: number,
  customStart: string,
  customEnd: string,
  now: Date = new Date(),
): DateRange {
  let start: Date;
  let end: Date;

  if (mode === "lastWeek") {
    const thisMonday = mondayOf(now);
    start = new Date(thisMonday.getTime() - 7 * DAY_MS);
    end = new Date(thisMonday.getTime() - DAY_MS);
  } else if (mode === "lastNDays") {
    const n = Math.min(Math.max(Math.floor(lastNDays) || 7, 1), 365);
    end = startOfDay(now);
    start = new Date(end.getTime() - (n - 1) * DAY_MS);
  } else if (mode === "custom") {
    const s = parseIsoDate(customStart);
    const e = parseIsoDate(customEnd);
    start = s ?? mondayOf(now);
    end = e ?? startOfDay(now);
    if (end.getTime() < start.getTime()) {
      const tmp = start;
      start = end;
      end = tmp;
    }
  } else {
    start = mondayOf(now);
    end = new Date(start.getTime() + 6 * DAY_MS);
  }

  start = startOfDay(start);
  end = startOfDay(end);
  const { year, week } = isoWeekOf(end);
  return {
    start,
    end,
    isoYear: year,
    isoWeek: week,
    label: `${formatCn(start)} - ${formatCn(end)}`,
  };
}

export function formatTitle(template: string, range: DateRange): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const title = (template || DEFAULT_TITLE_TEMPLATE)
    .replace(/\{\{YYYY\}\}/g, String(range.isoYear))
    .replace(/\{\{WW\}\}/g, pad(range.isoWeek))
    .replace(/\{\{W\}\}/g, String(range.isoWeek))
    .replace(/\{\{start\}\}/g, toSiyuanDate(range.start))
    .replace(/\{\{end\}\}/g, toSiyuanDate(range.end))
    .replace(/\{\{startCn\}\}/g, formatCn(range.start))
    .replace(/\{\{endCn\}\}/g, formatCnEnd(range.start, range.end));
  return sanitizeFileName(title.trim()) || "工作周报";
}

export function toSiyuanDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 去掉文件名/标题中的非法字符，保证 createDocWithMd 能正常创建文档 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
}
