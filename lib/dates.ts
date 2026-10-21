// All "day keys" are YYYY-MM-DD strings for a calendar day in Europe/Madrid.
export const TZ = "Europe/Madrid";

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayKey(date: Date | string): string {
  return keyFormatter.format(typeof date === "string" ? new Date(date) : date);
}

export function todayKey(): string {
  return dayKey(new Date());
}

function keyToUTC(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function addDays(key: string, n: number): string {
  const d = keyToUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUTC(toKey).getTime() - keyToUTC(fromKey).getTime()) / 86_400_000);
}

export function mondayOf(key: string): string {
  const weekday = keyToUTC(key).getUTCDay(); // 0 = Sunday
  return addDays(key, weekday === 0 ? -6 : 1 - weekday);
}

// Offset of Europe/Madrid from UTC (in ms) at a given instant.
function madridOffset(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - Math.floor(instant / 1000) * 1000;
}

// Converts a Madrid wall-clock time on a given day to an ISO timestamp.
export function madridToISO(key: string, time = "23:59"): string {
  const [y, m, d] = key.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let instant = wall - madridOffset(wall);
  instant = wall - madridOffset(instant);
  return new Date(instant).toISOString();
}

const shortFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

// "Thu 29 Oct"
export function formatDay(key: string): string {
  return shortFormatter.format(keyToUTC(key)).replace(",", "");
}

// "29 Oct"
export function formatDayMonth(key: string): string {
  return dayMonthFormatter.format(keyToUTC(key));
}

// "in 9 days", "today", "tomorrow", "2 days ago"
export function relativeDays(key: string, today = todayKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

// "just now", "5 min ago", "2 h ago", "3 days ago"
export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
