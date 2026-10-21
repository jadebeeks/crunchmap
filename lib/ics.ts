import ical, { type VEvent } from "node-ical";
import { guessType } from "./blackboard";
import { classifyEvent, ignoreKey, isAdminDate, type CalendarEvent } from "./classify";
import { dayKey, madridToISO } from "./dates";

export type ImportedRow = {
  title: string;
  due_at: string;
  type: string;
  course: string | null;
  source: "blackboard";
  external_uid: string;
};

export type ParseResult = {
  rows: ImportedRow[];
  // UIDs of every class session (or ignored event) in the feed, any date, so old rows can be cleaned up.
  classUids: string[];
  // Class sessions (and ignored events) inside the import window.
  skippedClasses: number;
  // Events outside the import window or without a usable date.
  skipped: number;
};

const DAY = 86_400_000;

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "val" in value) return String((value as { val: unknown }).val ?? "");
  return "";
}

function courseFrom(event: VEvent): string | null {
  const category = event.categories?.find((c) => c.trim());
  if (category) return category.trim().slice(0, 120);
  const match = text(event.description).match(/(?:course|curso|subject)\s*:\s*([^\n\r]+)/i);
  return match ? match[1].trim().slice(0, 120) : null;
}

// Parses an .ics body into deadline rows due from today (Europe/Madrid) up to 180 days ahead,
// leaving out class sessions and anything matching the user's "This is a class" rules.
export function parseDeadlines(
  body: string,
  { ignorePatterns = [], now = Date.now() }: { ignorePatterns?: string[]; now?: number } = {}
): ParseResult {
  const calendar = ical.sync.parseICS(body);
  const ignored = new Set(ignorePatterns.map((p) => ignoreKey(p)));
  const from = new Date(madridToISO(dayKey(new Date(now)), "00:00")).getTime();
  const until = now + 180 * DAY;
  const byUid = new Map<string, ImportedRow>();
  const classUids = new Set<string>();
  let skippedClasses = 0;
  let skipped = 0;

  for (const component of Object.values(calendar)) {
    if (!component || component.type !== "VEVENT") continue;
    const event = component as VEvent;
    // Blackboard due items set DTSTART = DTEND = due time; for all-day events DTEND is the next day.
    const end = event.end as (Date & { dateOnly?: true }) | undefined;
    const start = event.start as (Date & { dateOnly?: true }) | undefined;
    const due = end && !end.dateOnly && !start?.dateOnly ? end : start;
    const title = text(event.summary).trim();
    if (!event.uid || !start || !due || Number.isNaN(due.getTime())) {
      skipped++;
      continue;
    }

    const calendarEvent: CalendarEvent = {
      summary: title,
      uid: event.uid,
      start,
      end: end ?? null,
      location: text(event.location),
      description: text(event.description),
    };
    const isClass = ignored.has(ignoreKey(title)) || classifyEvent(calendarEvent) === "class";
    const time = due.getTime();
    const inWindow = time >= from && time <= until;

    if (isClass) {
      classUids.add(event.uid);
      if (inWindow) skippedClasses++;
      continue;
    }
    if (!inWindow) {
      skipped++;
      continue;
    }
    byUid.set(event.uid, {
      title: (title || "Untitled").slice(0, 120),
      due_at: due.toISOString(),
      type: isAdminDate(calendarEvent) ? "Admin" : guessType(title),
      course: courseFrom(event),
      source: "blackboard",
      external_uid: event.uid,
    });
  }

  return { rows: [...byUid.values()], classUids: [...classUids], skippedClasses, skipped };
}
