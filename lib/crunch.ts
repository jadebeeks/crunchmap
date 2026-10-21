import { addDays, dayKey, formatDay, formatDayMonth, mondayOf, todayKey } from "./dates";
import { isExamTitle } from "./blackboard";
import { isClassTitle } from "./classify";
import type { Deadline } from "./types";

export type Level = "Calm" | "Busy" | "Crunch";

export type Week = {
  start: string;
  end: string;
  count: number;
  exams: number;
  // Exams weigh 2 points, everything else 1; the level comes from the load, not the raw count.
  load: number;
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

// An exam is anything typed as Exam, or a default-typed item whose title reads like one.
export function isExam(d: Deadline): boolean {
  if (d.type === "Exam") return true;
  return (!d.type || d.type === "Assignment") && isExamTitle(d.title);
}

export function levelFor(load: number): Level {
  if (load >= 4) return "Crunch";
  if (load >= 2) return "Busy";
  return "Calm";
}

export function buildCrunchMap(deadlines: Deadline[], today = todayKey()): CrunchMap {
  const firstMonday = mondayOf(today);
  const lastDay = addDays(firstMonday, 8 * 7 - 1);
  // Done items, admin dates (e.g. "Last day to drop"), anything already past and imported class sessions
  // left over from an older sync don't add to the load, so tips never suggest starting a class.
  const pending = deadlines
    .filter((d) => !d.done && !isAdmin(d) && !(d.source === "blackboard" && isClassTitle(d.title)))
    .map((d) => ({ d, key: dayKey(d.due_at) }))
    .filter(({ key }) => key >= today && key <= lastDay)
    .sort((a, b) => a.d.due_at.localeCompare(b.d.due_at));

  const weeks: Week[] = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(firstMonday, i * 7);
    const end = addDays(start, 6);
    const inWeek = pending.filter(({ key }) => key >= start && key <= end).map(({ d }) => d);
    const exams = inWeek.filter(isExam).length;
    const load = inWeek.length + exams;
    return { start, end, count: inWeek.length, exams, load, level: levelFor(load), deadlines: inWeek };
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
      return `Week of ${formatDayMonth(w.start)} has ${w.count} ${w.count === 1 ? "deadline" : "deadlines"} — start '${first.title}' by ${formatDay(addDays(w.start, -7))}`;
    });

  return { weeks, clashes, tips };
}
