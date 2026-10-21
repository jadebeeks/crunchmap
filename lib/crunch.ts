import { addDays, dayKey, formatDay, formatDayMonth, mondayOf, todayKey } from "./dates";
import type { Deadline } from "./types";

export type Level = "Calm" | "Busy" | "Crunch";

export type Week = {
  start: string;
  end: string;
  count: number;
  level: Level;
  deadlines: Deadline[];
};

export type CrunchMap = {
  weeks: Week[];
  clashes: string[];
  tips: string[];
};

export function isAdmin(d: Deadline): boolean {
  return d.type === "Admin";
}

export function levelFor(count: number): Level {
  if (count >= 4) return "Crunch";
  if (count >= 2) return "Busy";
  return "Calm";
}

export function buildCrunchMap(deadlines: Deadline[], today = todayKey()): CrunchMap {
  const firstMonday = mondayOf(today);
  const lastDay = addDays(firstMonday, 8 * 7 - 1);
  // Done items, admin dates (e.g. "Last day to drop") and anything already past don't add to the load.
  const pending = deadlines
    .filter((d) => !d.done && !isAdmin(d))
    .map((d) => ({ d, key: dayKey(d.due_at) }))
    .filter(({ key }) => key >= today && key <= lastDay)
    .sort((a, b) => a.d.due_at.localeCompare(b.d.due_at));

  const weeks: Week[] = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(firstMonday, i * 7);
    const end = addDays(start, 6);
    const inWeek = pending.filter(({ key }) => key >= start && key <= end).map(({ d }) => d);
    return { start, end, count: inWeek.length, level: levelFor(inWeek.length), deadlines: inWeek };
  });

  const perDay = new Map<string, number>();
  for (const { key } of pending) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  const clashes = [...perDay.entries()]
    .filter(([, n]) => n >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, n]) => `Clash: ${n} deadlines on ${formatDay(key)}`);

  const tips = weeks
    .filter((w) => w.level !== "Calm")
    .map((w) => {
      const first = w.deadlines[0];
      return `Week of ${formatDayMonth(w.start)} has ${w.count} deadlines — start '${first.title}' by ${formatDay(addDays(w.start, -7))}`;
    });

  return { weeks, clashes, tips };
}
