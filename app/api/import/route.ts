import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBlackboardHost, isBlackboardIcs } from "@/lib/blackboard";
import { ignoreKey, isClassTitle } from "@/lib/classify";
import { parseDeadlines } from "@/lib/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const UNREACHABLE = "Couldn't reach Blackboard — check the link and try again";

async function fetchIcs(link: string): Promise<string> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = new URL(link);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { signal, redirect: "manual", headers: { Accept: "text/calendar" }, cache: "no-store" });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("redirect without location");
      url = new URL(location, url);
      // Only follow redirects that stay on Blackboard.
      if (!isBlackboardHost(url)) throw new Error("redirect off Blackboard");
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`status ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("too large");

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("too large");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("too many redirects");
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { data: source, error: sourceError } = await supabase
    .from("bb_calendar_sources")
    .select("ics_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sourceError) return NextResponse.json({ error: "Couldn't load your calendar link." }, { status: 500 });
  if (!source || !isBlackboardIcs(source.ics_url)) {
    return NextResponse.json(
      { error: "That doesn't look like a Blackboard calendar link (Blackboard → Calendar → Share Calendar)" },
      { status: 400 }
    );
  }

  // A missing bb_ignore_rules table just means "no rules yet"; it must never block the import.
  const { data: rules } = await supabase.from("bb_ignore_rules").select("pattern");
  const ignorePatterns = (rules ?? []).map((r) => r.pattern as string);

  // Remove imported rows that are class sessions (by UID from the feed or by title) or match a "This is a class" rule.
  const ignored = new Set(ignorePatterns.map(ignoreKey));
  async function removeClassRows(classUids: Set<string>): Promise<number> {
    const { data: existing } = await supabase
      .from("bb_deadlines")
      .select("id, title, external_uid")
      .eq("user_id", user!.id)
      .eq("source", "blackboard");
    const staleIds = (existing ?? [])
      .filter(
        (d) =>
          (d.external_uid && classUids.has(d.external_uid)) || isClassTitle(d.title) || ignored.has(ignoreKey(d.title))
      )
      .map((d) => d.id as string);
    for (let i = 0; i < staleIds.length; i += 100) {
      await supabase.from("bb_deadlines").delete().in("id", staleIds.slice(i, i + 100));
    }
    return staleIds.length;
  }

  let parsed: ReturnType<typeof parseDeadlines>;
  try {
    parsed = parseDeadlines(await fetchIcs(source.ics_url), { ignorePatterns });
  } catch {
    // Even when Blackboard is unreachable, clear class sessions left over from older syncs.
    await removeClassRows(new Set());
    return NextResponse.json({ error: UNREACHABLE }, { status: 502 });
  }

  if (parsed.rows.length > 0) {
    // `done` is deliberately not sent, so re-syncing never un-ticks a finished deadline.
    const { error } = await supabase
      .from("bb_deadlines")
      .upsert(
        parsed.rows.map((row) => ({ ...row, user_id: user.id })),
        { onConflict: "user_id,external_uid" }
      );
    if (error) return NextResponse.json({ error: "Couldn't save your deadlines. Please try again." }, { status: 500 });
  }

  const removed = await removeClassRows(new Set(parsed.classUids));

  const lastSyncedAt = new Date().toISOString();
  await supabase.from("bb_calendar_sources").update({ last_synced_at: lastSyncedAt }).eq("user_id", user.id);

  return NextResponse.json({
    imported: parsed.rows.length,
    skippedClasses: parsed.skippedClasses,
    removed,
    lastSyncedAt,
  });
}
