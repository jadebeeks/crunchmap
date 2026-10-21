import { describe, expect, it } from "vitest";
import { classifyEvent, explainEvent, ignoreKey, isAdminDate, normalizeClassTitle, type CalendarEvent } from "./classify";

const CAL = "_blackboard.data.calendar.CalendarEntry-_1001_1";
const GRADABLE = "_blackboard.platform.gradebook2.GradableItem-_2002_1";
const TIMETABLE = "Lecturer Name. ICALUID:F1PLANI123PABCDEF12S3456789A";

function event(summary: string, opts: Partial<CalendarEvent> & { minutes?: number; at?: string } = {}): CalendarEvent {
  const start = new Date(opts.at ?? "2026-11-03T10:30:00+01:00");
  const end = new Date(start.getTime() + (opts.minutes ?? 0) * 60_000);
  return { summary, uid: opts.uid ?? CAL, start, end, location: opts.location, description: opts.description };
}

describe("class sessions", () => {
  it.each([
    "FUNDAMENTALS OF DATA ANALYSIS  (Ses. 9) Live in-person ",
    "MATH 0.1: CALCULUS  (Ses. 8) Live in-person ",
    "IE HUMANITIES  (Ses. 26-27) Live in-person ",
    "COMPUTATIONAL THINKING FOR DATA MANAGEMENT AND ANALYSIS  (Ses. 29-30) ",
    "BEHAVIOR LAB Extra Live online ",
  ])("timetabled session %s is a class", (title) => {
    const e = event(title, { minutes: 80, location: "T-4.03", description: TIMETABLE });
    expect(classifyEvent(e)).toBe("class");
    expect(explainEvent(e).reason).toBe("timetable-id");
  });

  it("an all-day asynchronous session is a class", () => {
    const e = event("IE HUMANITIES  (Ses. 5) Asynchronous ", { minutes: 1439, location: "Online", description: TIMETABLE });
    expect(classifyEvent(e)).toBe("class");
  });

  it.each([
    "BIG DATA TECHNOLOGY (Ses. 15) Live in-person",
    "STATISTICS Ses 4",
    "Session 12 - Marketing",
    "Guest Lecture: Responsible AI",
    "Live online catch-up",
  ])("keyword backup catches %s without the timetabling ID", (title) => {
    const e = event(title, { minutes: 80, location: "T-1.01" });
    expect(classifyEvent(e)).toBe("class");
  });

  it("a short timed campus event with a room is skipped as a class", () => {
    expect(classifyEvent(event("IEU LABs Fair Madrid", { minutes: 150, location: "Ground Hall" }))).toBe("class");
    expect(classifyEvent(event("IEU LABs Closing Ceremony", { minutes: 180, location: "IE Tower Auditorium" }))).toBe("class");
  });
});

describe("deadlines", () => {
  it.each([
    "Evaluation Activity 6: Final Group Presentation",
    "STEP 2: Orientation",
    "Evaluation Activity 1",
  ])("gradable item %s is a deadline", (title) => {
    expect(classifyEvent(event(title, { uid: GRADABLE, at: "2026-11-03T23:59:00+01:00" }))).toBe("deadline");
  });

  it.each([
    "Deadline of Video 3 - Introduction to Proofs",
    "Hand in - Assignment 1 -  Peer Graded ",
    "Give feedback - Assignment 1 -  Peer Graded ",
    "D3 Collaborative filtering recommenders",
  ])("zero-length calendar entry %s is a deadline", (title) => {
    expect(classifyEvent(event(title, { location: "" }))).toBe("deadline");
  });

  it("deadline words always win, even over session words and structure", () => {
    expect(classifyEvent(event("session 30 final exam", { uid: GRADABLE }))).toBe("deadline");
    expect(classifyEvent(event("Presentation for session 2", { uid: GRADABLE }))).toBe("deadline");
    expect(
      classifyEvent(event("STATISTICS (Ses. 14) Midterm exam Live in-person", { minutes: 80, location: "T-4.03", description: TIMETABLE }))
    ).toBe("deadline");
    expect(classifyEvent(event("Group project kickoff Lecture", { minutes: 80, location: "T-2.01" }))).toBe("deadline");
  });
});

describe("admin dates", () => {
  it.each(["Last day to drop LABs", "LABs Add/Drop Begins", "Enrollment Opening for Segovia LABs"])(
    "%s is an admin deadline",
    (title) => {
      const e = event(title, { minutes: 1439, at: "2026-11-03T00:00:00+01:00", location: "Madrid" });
      expect(classifyEvent(e)).toBe("deadline");
      expect(isAdminDate(e)).toBe(true);
    }
  );

  it("a long daytime admin window is an admin date, not a class", () => {
    const e = event("IEU LABs Add/ Drop Begins", { minutes: 839, location: "Online" });
    expect(isAdminDate(e)).toBe(true);
  });

  it("normal deadlines are not admin dates", () => {
    expect(isAdminDate(event("Evaluation Activity 1", { uid: GRADABLE }))).toBe(false);
  });
});

describe("normalizeClassTitle", () => {
  it("strips session numbers", () => {
    expect(normalizeClassTitle("(Ses. 15) BIG DATA TECHNOLOGY Live in-person")).toBe("BIG DATA TECHNOLOGY Live in-person");
    expect(normalizeClassTitle("BIG DATA TECHNOLOGY  (Ses. 16) Live in-person ")).toBe("BIG DATA TECHNOLOGY Live in-person");
    expect(normalizeClassTitle("IE HUMANITIES  (Ses. 26-27) Live in-person")).toBe("IE HUMANITIES Live in-person");
    expect(normalizeClassTitle("Session 12 Marketing Ses 3")).toBe("Marketing");
  });

  it("gives every session of a course the same ignore key", () => {
    expect(ignoreKey("BIG DATA TECHNOLOGY (Ses. 1) Live in-person")).toBe(ignoreKey("big data technology (Ses. 22) Live In-Person"));
  });
});
