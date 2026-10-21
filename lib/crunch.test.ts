import { describe, expect, it } from "vitest";
import { buildCrunchMap, isExam } from "./crunch";
import { guessType, isExamTitle } from "./blackboard";
import type { Deadline } from "./types";

let n = 0;
const item = (title: string, due_at: string, extra: Partial<Deadline> = {}): Deadline => ({
  id: String(++n),
  title,
  due_at,
  type: "Assignment",
  course: null,
  done: false,
  source: "blackboard",
  created_at: "",
  ...extra,
});

describe("buildCrunchMap tips", () => {
  const today = "2026-10-21";
  // Week of 9 Nov: a leftover class session (from an older sync) sits before the real deadlines.
  const deadlines = [
    item("PROJECT MANAGEMENT (Ses. 9) Live in-person", "2026-11-09T09:00:00Z"),
    item("Statistics midterm", "2026-11-10T22:59:00Z", { type: "Exam" }),
    item("Group project submission", "2026-11-11T22:59:00Z"),
    item("Last day to drop LABs", "2026-11-09T22:59:00Z", { type: "Admin" }),
    item("Essay draft", "2026-11-12T22:59:00Z", { done: true }),
  ];
  const map = buildCrunchMap(deadlines, today);
  const week = map.weeks.find((w) => w.start === "2026-11-09")!;

  it("counts only real, pending deadlines", () => {
    expect(week.count).toBe(2);
    expect(week.level).toBe("Busy");
  });

  it("never suggests starting a class session", () => {
    expect(map.tips).toEqual(["Week of 9 Nov has 2 deadlines — start 'Statistics midterm' by Mon 2 Nov"]);
    expect(map.tips.join(" ")).not.toMatch(/Ses\./);
  });

  it("keeps a typed deadline whose title happens to look like a session", () => {
    const typed = buildCrunchMap([item("Revise (Ses. 3) notes", "2026-11-10T22:59:00Z", { source: "manual" })], today);
    expect(typed.weeks.find((w) => w.start === "2026-11-09")!.count).toBe(1);
  });
});

describe("exams", () => {
  it.each(["Statistics midterm", "Final exam", "Quiz 3", "Unit test 2", "FINALS week", "Midterm deliverable"])(
    "%s reads as an exam",
    (title) => {
      expect(isExamTitle(title)).toBe(true);
      expect(guessType(title)).toBe("Exam");
    }
  );

  it.each(["SOFTWARE TESTING (Ses. 4)", "Finally done: reflection", "Essay draft", "Contest entry"])("%s is not an exam", (title) => {
    expect(isExamTitle(title)).toBe(false);
  });

  it("uses the chosen type: Exam always counts, other explicit types don't get overridden", () => {
    expect(isExam(item("Oral defence", "2026-11-10T22:59:00Z", { type: "Exam" }))).toBe(true);
    expect(isExam(item("Driving test", "2026-11-10T22:59:00Z", { type: "Personal", source: "manual" }))).toBe(false);
    expect(isExam(item("Chapter 3 quiz", "2026-11-10T22:59:00Z", { type: "Assignment" }))).toBe(true);
  });

  it("weighs exams double in the load but shows the real count", () => {
    const today = "2026-10-21";
    const one = buildCrunchMap([item("Statistics midterm", "2026-11-10T22:59:00Z", { type: "Exam" })], today);
    const week = one.weeks.find((w) => w.start === "2026-11-09")!;
    expect([week.count, week.exams, week.load, week.level]).toEqual([1, 1, 2, "Busy"]);
    expect(one.tips).toEqual(["Week of 9 Nov has 1 deadline — start 'Statistics midterm' by Mon 2 Nov"]);

    const mixed = buildCrunchMap(
      [
        item("Statistics midterm", "2026-11-10T22:59:00Z", { type: "Exam" }),
        item("Final exam", "2026-11-12T22:59:00Z", { type: "Exam" }),
      ],
      today
    );
    const w2 = mixed.weeks.find((w) => w.start === "2026-11-09")!;
    expect([w2.count, w2.exams, w2.load, w2.level]).toEqual([2, 2, 4, "Crunch"]);

    const calm = buildCrunchMap([item("Essay draft", "2026-11-10T22:59:00Z")], today);
    expect(calm.weeks.find((w) => w.start === "2026-11-09")!.level).toBe("Calm");
  });
});
