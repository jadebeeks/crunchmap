"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEADLINE_TYPES, isBlackboardIcs, isExamTitle, maskUrl } from "@/lib/blackboard";
import { ignoreKey, isClassTitle, normalizeClassTitle } from "@/lib/classify";
import { buildCrunchMap, isAdmin, isExam, type Level } from "@/lib/crunch";
import { addDays, dayKey, formatDay, formatDayMonth, madridToISO, relativeDays, timeAgo, todayKey } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

type Source = { masked: string; lastSyncedAt: string | null };
type Status = { tone: "ok" | "error" | "info"; text: string } | null;
type ImportResult = { imported: number; skippedClasses: number };

const COLUMNS = "id, title, due_at, type, course, done, source, created_at";
const NOT_BLACKBOARD = "That doesn't look like a Blackboard calendar link (Blackboard → Calendar → Share Calendar)";
const SYNC_EVERY_MS = 4 * 60 * 60 * 1000;

const levelStyles: Record<Level, string> = {
  Calm: "border-green-600 bg-green-50 text-green-900",
  Busy: "border-amber-500 bg-amber-50 text-amber-900",
  Crunch: "border-red-600 bg-red-50 text-red-900",
};
const levelBadge: Record<Level, string> = {
  Calm: "bg-green-700 text-white",
  Busy: "bg-amber-300 text-amber-950",
  Crunch: "bg-red-700 text-white",
};

const byDue = (a: Deadline, b: Deadline) => a.due_at.localeCompare(b.due_at);
const defaultDueKey = () => addDays(todayKey(), 7);
const importMessage = (r: ImportResult) =>
  `Imported ${r.imported} deadlines · skipped ${r.skippedClasses} class sessions`;

export default function CrunchApp({
  userId,
  initialDeadlines,
  initialSource,
}: {
  userId: string;
  initialDeadlines: Deadline[];
  initialSource: Source | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [deadlines, setDeadlines] = useState<Deadline[]>(initialDeadlines);
  const [source, setSource] = useState<Source | null>(initialSource);
  const [text, setText] = useState("");
  const [dueKey, setDueKey] = useState(defaultDueKey);
  const [type, setType] = useState<string>("Assignment");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [, setTick] = useState(0);
  const autoSynced = useRef(false);

  const isLink = /^http/i.test(text.trim());

  async function reload() {
    const { data, error } = await supabase.from("bb_deadlines").select(COLUMNS).order("due_at", { ascending: true });
    if (!error && data) setDeadlines(data as Deadline[]);
  }

  async function runImport(): Promise<ImportResult> {
    setSyncing(true);
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't reach Blackboard — check the link and try again");
      setSource((s) => (s ? { ...s, lastSyncedAt: body.lastSyncedAt } : s));
      await reload();
      return { imported: body.imported ?? 0, skippedClasses: body.skippedClasses ?? 0 };
    } finally {
      setSyncing(false);
    }
  }

  async function sync() {
    try {
      setStatus({ tone: "ok", text: importMessage(await runImport()) });
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    }
  }

  // Auto-sync on load when the last sync is older than 4 hours, or when class sessions from an older sync
  // are still in the list (the sync removes them).
  useEffect(() => {
    if (autoSynced.current || !initialSource) return;
    autoSynced.current = true;
    const last = initialSource.lastSyncedAt ? new Date(initialSource.lastSyncedAt).getTime() : 0;
    const hasClassRows = initialDeadlines.some((d) => d.source === "blackboard" && isClassTitle(d.title));
    if (Date.now() - last > SYNC_EVERY_MS || hasClassRows) {
      setStatus({ tone: "info", text: "Syncing with Blackboard…" });
      sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep "Last synced X ago" and "in N days" fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setStatus(null);

    try {
      if (isBlackboardIcs(value)) {
        const { error } = await supabase
          .from("bb_calendar_sources")
          .upsert({ user_id: userId, ics_url: value, last_synced_at: null }, { onConflict: "user_id" });
        if (error) throw new Error("Couldn't save your calendar link. Please try again.");
        setSource({ masked: maskUrl(value), lastSyncedAt: null });
        setText("");
        await sync();
      } else if (/^http/i.test(value)) {
        setStatus({ tone: "error", text: NOT_BLACKBOARD });
      } else {
        const { data, error } = await supabase
          .from("bb_deadlines")
          .insert({
            user_id: userId,
            title: value.slice(0, 120),
            due_at: madridToISO(dueKey || defaultDueKey()),
            // Left on the default type, an exam-sounding title ("Statistics midterm") is saved as an Exam.
            type: type === "Assignment" && isExamTitle(value) ? "Exam" : type,
            course: course.trim() || null,
            source: "manual",
          })
          .select(COLUMNS)
          .single();
        if (error || !data) throw new Error(error?.message ?? "Couldn't save your deadline. Please try again.");
        setDeadlines((list) => [...list, data as Deadline].sort(byDue));
        setText("");
        setDueKey(defaultDueKey());
        setType("Assignment");
        setCourse("");
        setStatus({ tone: "ok", text: "Deadline added" });
      }
    } catch (err) {
      setStatus({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(d: Deadline) {
    const done = !d.done;
    setDeadlines((list) => list.map((x) => (x.id === d.id ? { ...x, done } : x)));
    const { error } = await supabase.from("bb_deadlines").update({ done }).eq("id", d.id);
    if (error) {
      setDeadlines((list) => list.map((x) => (x.id === d.id ? { ...x, done: d.done } : x)));
      setStatus({ tone: "error", text: "Couldn't update that deadline. Please try again." });
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("bb_deadlines").delete().eq("id", id);
    setConfirmDelete(null);
    if (error) {
      setStatus({ tone: "error", text: "Couldn't delete that deadline. Please try again." });
      return;
    }
    setDeadlines((list) => list.filter((x) => x.id !== id));
  }

  // "This is a class": remember the title (session numbers stripped) and drop every matching imported item.
  async function markAsClass(d: Deadline) {
    const pattern = normalizeClassTitle(d.title) || d.title;
    const { error: ruleError } = await supabase
      .from("bb_ignore_rules")
      .upsert({ user_id: userId, pattern }, { onConflict: "user_id,pattern", ignoreDuplicates: true });
    if (ruleError) {
      setStatus({ tone: "error", text: "Couldn't save that rule. Please try again." });
      return;
    }
    const key = ignoreKey(d.title);
    const ids = deadlines.filter((x) => x.source === "blackboard" && ignoreKey(x.title) === key).map((x) => x.id);
    const { error } = await supabase.from("bb_deadlines").delete().in("id", ids);
    if (error) {
      setStatus({ tone: "error", text: "Couldn't remove that item. Please try again." });
      return;
    }
    setDeadlines((list) => list.filter((x) => !ids.includes(x.id)));
    setStatus({ tone: "ok", text: `Got it — “${pattern}” will be skipped in future syncs.` });
  }

  async function removeLink() {
    const { error } = await supabase.from("bb_calendar_sources").delete().eq("user_id", userId);
    setConfirmRemove(false);
    if (error) {
      setStatus({ tone: "error", text: "Couldn't remove the link. Please try again." });
      return;
    }
    setSource(null);
    setStatus({ tone: "ok", text: "Blackboard link removed. Your imported deadlines are kept." });
  }

  const today = todayKey();
  const map = buildCrunchMap(deadlines, today);
  const mapIsEmpty = map.weeks.every((w) => w.count === 0);
  const showGuide = !guideDismissed && !source && deadlines.length === 0;
  const isPast = (d: Deadline) => !d.done && dayKey(d.due_at) < today;
  const pending = deadlines.filter((d) => !d.done && !isPast(d)).sort(byDue);
  const done = deadlines.filter((d) => d.done).sort(byDue);
  const past = deadlines.filter(isPast).sort(byDue);

  const statusClass =
    status?.tone === "error"
      ? "bg-red-50 text-red-800 border-red-300"
      : status?.tone === "ok"
        ? "bg-green-50 text-green-900 border-green-300"
        : "bg-slate-100 text-slate-800 border-slate-300";

  const renderItem = (d: Deadline) => {
    const key = dayKey(d.due_at);
    const fromBlackboard = d.source === "blackboard";
    const exam = isExam(d);
    return (
      <li
        key={d.id}
        data-testid="core-item"
        className={`rounded-lg border p-3 ${d.done ? "border-slate-200 bg-slate-100 text-slate-600" : "border-slate-200 bg-white"}`}
      >
        <div className="flex items-start gap-3">
          <input
            id={`done-${d.id}`}
            type="checkbox"
            checked={d.done}
            onChange={() => toggleDone(d)}
            className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
            aria-label={`Done: ${d.title}`}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`${exam ? "font-extrabold" : "font-semibold"} [overflow-wrap:anywhere] ${d.done ? "line-through" : "text-slate-900"}`}
            >
              {d.title}
            </p>
            <p className="mt-0.5 text-sm text-slate-700">
              <span>{formatDay(key)}</span> · <span suppressHydrationWarning>{relativeDays(key, today)}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
              {exam ? (
                <span className="inline-flex items-center gap-1 rounded border border-rose-700 bg-rose-50 px-2 py-0.5 font-bold text-rose-900">
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
                    <path d="M5.5 5h5M5.5 8h5M5.5 11h3" />
                  </svg>
                  Exam
                </span>
              ) : (
                <span
                  className={`rounded px-2 py-0.5 ${isAdmin(d) ? "bg-amber-100 text-amber-950" : "bg-slate-200 text-slate-800"}`}
                >
                  {d.type ?? "Assignment"}
                </span>
              )}
              {d.course && (
                <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-900 [overflow-wrap:anywhere]">{d.course}</span>
              )}
              <span
                className={`rounded px-2 py-0.5 ${fromBlackboard ? "bg-teal-100 text-teal-900" : "bg-violet-100 text-violet-900"}`}
              >
                {fromBlackboard ? "From Blackboard" : "Added by you"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
            <label htmlFor={`done-${d.id}`} className="cursor-pointer text-slate-700">
              Done
            </label>
            {fromBlackboard && confirmDelete !== d.id && (
              <button
                type="button"
                onClick={() => markAsClass(d)}
                className="text-xs text-slate-700 underline"
                aria-label={`This is a class: ${d.title}`}
              >
                This is a class
              </button>
            )}
            {confirmDelete === d.id ? (
              <span className="flex flex-col items-end gap-1">
                <button type="button" onClick={() => remove(d.id)} className="font-semibold text-red-800 underline">
                  Confirm delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(null)} className="text-slate-700 underline">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(d.id)}
                className="text-red-800 underline"
                aria-label={`Delete ${d.title}`}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      {/* First visit: a short guide above the smart box (not a modal, the box stays usable). */}
      {showGuide && (
        <section aria-labelledby="guide-heading" className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-slate-900 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="guide-heading" className="text-lg font-semibold">
              Get started
            </h2>
            <button type="button" onClick={() => setGuideDismissed(true)} className="text-sm text-slate-800 underline">
              Dismiss
            </button>
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>In Blackboard open Calendar → Share Calendar → copy the link.</li>
            <li>Paste it in the box below and click Import calendar.</li>
            <li>Check your crunch weeks and start early.</li>
          </ol>
        </section>
      )}

      {/* a) Smart box */}
      <section aria-labelledby="smart-box-label" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <label id="smart-box-label" htmlFor="core-input" className="block text-lg font-semibold text-slate-900">
            Paste your Blackboard calendar link — or type a deadline
          </label>
          <p id="core-help" className="text-sm text-slate-700">
            Blackboard → Calendar → Share Calendar → copy link
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="core-input"
              type="text"
              required
              maxLength={2000}
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://blackboard.ie.edu/…/learn.ics or e.g. Statistics midterm"
              aria-describedby="core-help"
              data-testid="core-input"
              className="min-w-0 flex-1 rounded-md border border-slate-400 px-3 py-2.5 text-slate-900 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={busy}
              data-testid="core-submit"
              className="rounded-md bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {isLink ? "Import calendar" : "Add deadline"}
            </button>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">More options for a typed deadline</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="due-date" className="block font-medium text-slate-800">
                  Due date
                </label>
                <input
                  id="due-date"
                  type="date"
                  value={dueKey}
                  onChange={(e) => setDueKey(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-400 px-2 py-2 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="deadline-type" className="block font-medium text-slate-800">
                  Type
                </label>
                <select
                  id="deadline-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-400 bg-white px-2 py-2 text-slate-900"
                >
                  {DEADLINE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="deadline-course" className="block font-medium text-slate-800">
                  Course (optional)
                </label>
                <input
                  id="deadline-course"
                  type="text"
                  maxLength={120}
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-400 px-2 py-2 text-slate-900"
                />
              </div>
            </div>
          </details>

          <div aria-live="polite">
            {status && <p className={`rounded-md border p-3 text-sm ${statusClass}`}>{status.text}</p>}
          </div>
        </form>
      </section>

      {/* b) Connected bar */}
      {source && (
        <section
          aria-label="Blackboard connection"
          className="flex flex-col gap-2 rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="min-w-0 [overflow-wrap:anywhere]">
            <strong>Blackboard connected</strong> · {source.masked} ·{" "}
            <span suppressHydrationWarning>
              {syncing ? "Syncing…" : source.lastSyncedAt ? `Last synced ${timeAgo(source.lastSyncedAt)}` : "Not synced yet"}
            </span>
          </p>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              disabled={syncing}
              onClick={() => sync()}
              className="rounded-md bg-teal-700 px-3 py-1.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              Sync now
            </button>
            {confirmRemove ? (
              <>
                <button type="button" onClick={removeLink} className="font-semibold text-red-800 underline">
                  Confirm remove
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="text-slate-800 underline">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} className="text-slate-800 underline">
                Remove link
              </button>
            )}
          </div>
        </section>
      )}

      {/* c) Crunch map */}
      <section aria-labelledby="map-heading">
        <h2 id="map-heading" className="text-xl font-bold text-slate-900">
          Your next 8 weeks
        </h2>
        {mapIsEmpty && (
          <p className="mt-1 text-sm text-slate-700">Your weeks appear here after you import or add a deadline.</p>
        )}
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {map.weeks.map((w) => (
            <li key={w.start} className={`min-w-0 rounded-lg border-2 p-3 ${levelStyles[w.level]}`}>
              <p className="text-sm font-semibold">Week of {formatDayMonth(w.start)}</p>
              <p className="text-xs">
                {formatDayMonth(w.start)} – {formatDayMonth(w.end)}
              </p>
              <p className="mt-2 text-2xl font-bold">{w.count}</p>
              <p className="text-xs">
                {w.count === 1 ? "deadline" : "deadlines"}
                {w.exams > 0 && ` (incl. ${w.exams} ${w.exams === 1 ? "exam" : "exams"})`}
              </p>
              <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-bold ${levelBadge[w.level]}`}>
                {w.level}
              </span>
            </li>
          ))}
        </ol>
        {(map.clashes.length > 0 || map.tips.length > 0) && (
          <div className="mt-4 space-y-2 text-sm">
            {map.clashes.length > 0 && (
              <ul className="space-y-1">
                {map.clashes.map((c) => (
                  <li key={c} className="font-medium text-red-800">
                    ⚠ {c}
                  </li>
                ))}
              </ul>
            )}
            {map.tips.length > 0 && (
              <ul className="space-y-1">
                {map.tips.map((t) => (
                  <li key={t} className="text-slate-800 [overflow-wrap:anywhere]">
                    💡 {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* d) Deadline list */}
      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-xl font-bold text-slate-900">
          Deadlines
        </h2>
        {deadlines.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-400 p-4 text-slate-700">
            No deadlines yet — paste your Blackboard calendar link above.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">{pending.map(renderItem)}</ul>
            {done.length > 0 && (
              <>
                <h3 className="mt-6 font-semibold text-slate-700">Done</h3>
                <ul className="mt-2 space-y-2">{done.map(renderItem)}</ul>
              </>
            )}
            {past.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer font-semibold text-slate-700">Past ({past.length})</summary>
                <ul className="mt-2 space-y-2 opacity-90">{past.map(renderItem)}</ul>
              </details>
            )}
          </>
        )}
      </section>
    </main>
  );
}
