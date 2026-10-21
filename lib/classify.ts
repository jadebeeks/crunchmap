// Tells Blackboard class sessions apart from real deadlines. Structural signals come first because they
// come from how Blackboard and IE's timetabling system build the feed, not from any one programme's titles.

export type CalendarEvent = {
  summary: string;
  uid: string;
  start: Date;
  end?: Date | null;
  location?: string | null;
  description?: string | null;
};

export type Classification = "class" | "deadline";

export type ClassificationReason =
  | "deadline-word"
  | "gradable-item"
  | "zero-length"
  | "timetable-id"
  | "session-word"
  | "timed-with-room"
  | "admin-date"
  | "default";

// Only words that never appear in course names. "Project", "assignment", "presentation", "pitch" and "test"
// are left out because courses such as "PROJECT MANAGEMENT" or "SOFTWARE TESTING" contain them.
const STRONG_DEADLINE_WORDS =
  /\b(exams?|midterms?|final\s+exams?|quiz(zes)?|deadlines?|due|submissions?|submit|hand[- ]?in)\b/i;

// Markers that only timetabled sessions carry.
const SESSION_MARKERS =
  /\(\s*Ses\.?\s*\d+(\s*-\s*\d+)?\s*\)|\bSes\.?\s*\d+|\bSession\s*\d+|\bLive\s+(in-person|online)\b/i;

const CLASS_WORDS = /\bLectures?\b|\bClass(es)?\b|\bAsynchronous\b/i;

// IE's timetabling system stamps every scheduled session with "ICALUID:…PLANI…" in the description.
const TIMETABLE_ID = /ICALUID:\S*PLANI/i;

// Campus events (fairs, ceremonies) last a few hours; longer spans are admin dates such as add/drop windows.
const MAX_CLASS_MINUTES = 6 * 60;

function minutes(event: CalendarEvent): number {
  if (!event.end) return 0;
  return Math.round((event.end.getTime() - event.start.getTime()) / 60_000);
}

export function explainEvent(event: CalendarEvent): { kind: Classification; reason: ClassificationReason } {
  const title = event.summary ?? "";
  const length = minutes(event);

  if (STRONG_DEADLINE_WORDS.test(title)) return { kind: "deadline", reason: "deadline-word" };
  // Blackboard only uses GradableItem UIDs for graded work, e.g. "Presentation for session 2".
  if (/GradableItem/i.test(event.uid)) return { kind: "deadline", reason: "gradable-item" };
  if (TIMETABLE_ID.test(event.description ?? "")) return { kind: "class", reason: "timetable-id" };
  if (SESSION_MARKERS.test(title)) return { kind: "class", reason: "session-word" };
  if (length <= 0) return { kind: "deadline", reason: "zero-length" };
  if (CLASS_WORDS.test(title)) return { kind: "class", reason: "session-word" };
  if (length < MAX_CLASS_MINUTES && event.location?.trim()) return { kind: "class", reason: "timed-with-room" };
  if (length >= MAX_CLASS_MINUTES) return { kind: "deadline", reason: "admin-date" };
  return { kind: "deadline", reason: "default" };
}

// A title that reads as a class session: a session marker and no strong deadline word.
export function isClassTitle(title: string): boolean {
  return SESSION_MARKERS.test(title) && !STRONG_DEADLINE_WORDS.test(title);
}

export function classifyEvent(event: CalendarEvent): Classification {
  return explainEvent(event).kind;
}

// Long, non-class calendar entries such as "Last day to drop LABs": imported, but kept out of the crunch map.
export function isAdminDate(event: CalendarEvent): boolean {
  return explainEvent(event).reason === "admin-date";
}

// "(Ses. 15) BIG DATA TECHNOLOGY Live in-person" → "BIG DATA TECHNOLOGY Live in-person"
export function normalizeClassTitle(title: string): string {
  return title
    .replace(/\(\s*Ses\.?\s*\d+(\s*-\s*\d+)?\s*\)/gi, " ")
    .replace(/\bSes\.?\s*\d+(\s*-\s*\d+)?/gi, " ")
    .replace(/\bSession\s*\d+(\s*-\s*\d+)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

// Case-insensitive key used to match events against a user's "This is a class" rules.
export function ignoreKey(title: string): string {
  return normalizeClassTitle(title).toLowerCase();
}
