export const BLACKBOARD_HOST = "blackboard.ie.edu";

export function isBlackboardHost(url: URL): boolean {
  return url.protocol === "https:" && url.hostname === BLACKBOARD_HOST && !url.username && !url.password && (url.port === "" || url.port === "443");
}

export function isBlackboardIcs(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return isBlackboardHost(url) && url.pathname.toLowerCase().endsWith(".ics");
  } catch {
    return false;
  }
}

// "blackboard.ie.edu/…/learn.ics" — never expose the private token in the path or query.
export function maskUrl(text: string): string {
  try {
    const url = new URL(text);
    const file = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return `${url.hostname}/…/${file}`;
  } catch {
    return `${BLACKBOARD_HOST}/…`;
  }
}

export const DEADLINE_TYPES = ["Assignment", "Exam", "Group project", "Presentation", "Personal"] as const;

export function guessType(title: string): string {
  if (/exam|midterm|final/i.test(title)) return "Exam";
  if (/group/i.test(title)) return "Group project";
  if (/presentation|pitch/i.test(title)) return "Presentation";
  return "Assignment";
}
