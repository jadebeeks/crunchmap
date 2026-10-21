import { describe, expect, it } from "vitest";
import { parseDeadlines } from "./ics";

const TZ = "TZID=Europe/Madrid";
const ev = (uid: string, summary: string, start: string, end: string, extra: string[] = []) =>
  ["BEGIN:VEVENT", `UID:${uid}`, `SUMMARY:${summary}`, `DTSTART;${TZ}:${start}`, `DTEND;${TZ}:${end}`, ...extra, "END:VEVENT"];

const feed = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Blackboard//EN",
  ...ev("_blackboard.data.calendar.CalendarEntry-_1_1", "BIG DATA TECHNOLOGY  (Ses. 15) Live in-person ", "20261103T103000", "20261103T115000", [
    "LOCATION:T-4.03",
    "DESCRIPTION:Lecturer Name. ICALUID:F1PLANI2PABCDEF12S3456789A",
  ]),
  ...ev("_blackboard.data.calendar.CalendarEntry-_2_1", "BIG DATA TECHNOLOGY  (Ses. 3) Live in-person ", "20261001T103000", "20261001T115000", [
    "LOCATION:T-4.03",
    "DESCRIPTION:Lecturer Name. ICALUID:F1PLANI2PABCDEF12S3456789B",
  ]),
  ...ev("_blackboard.platform.gradebook2.GradableItem-_3_1", "Evaluation Activity 2: Midterm exam", "20261104T235900", "20261104T235900"),
  ...ev("_blackboard.data.calendar.CalendarEntry-_4_1", "Last day to drop LABs", "20261105T000000", "20261105T235900", ["LOCATION:Madrid"]),
  ...ev("_blackboard.data.calendar.CalendarEntry-_5_1", "IEU LABs Fair Madrid", "20261106T123000", "20261106T150000", ["LOCATION:Ground Hall"]),
  ...ev("_blackboard.data.calendar.CalendarEntry-_6_1", "Hand in - Assignment 1 - Peer Graded", "20261019T170000", "20261019T170000"),
  ...ev("_blackboard.data.calendar.CalendarEntry-_7_1", "Weekly reflection journal", "20261108T235900", "20261108T235900"),
  "END:VCALENDAR",
].join("\r\n");

const NOW = Date.parse("2026-10-21T10:00:00Z");

describe("parseDeadlines", () => {
  const result = parseDeadlines(feed, { now: NOW });

  it("imports deadlines and admin dates from today onwards, skipping classes and past items", () => {
    expect(result.rows.map((r) => [r.title, r.type])).toEqual(
      expect.arrayContaining([
        ["Evaluation Activity 2: Midterm exam", "Exam"],
        ["Last day to drop LABs", "Admin"],
        ["Weekly reflection journal", "Assignment"],
      ])
    );
    expect(result.rows).toHaveLength(3);
  });

  it("counts skipped class sessions inside the window and remembers every class UID", () => {
    expect(result.skippedClasses).toBe(2); // the session on 3 Nov and the campus fair
    expect(result.classUids).toHaveLength(3); // plus the October session, for cleanup of old rows
  });

  it("skips events matching a user's ignore rule", () => {
    const withRule = parseDeadlines(feed, { now: NOW, ignorePatterns: ["Weekly reflection journal"] });
    expect(withRule.rows.map((r) => r.title)).not.toContain("Weekly reflection journal");
    expect(withRule.skippedClasses).toBe(3);
  });
});
