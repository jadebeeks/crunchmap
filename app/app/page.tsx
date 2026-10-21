import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { maskUrl } from "@/lib/blackboard";
import type { Deadline } from "@/lib/types";
import CrunchApp from "./CrunchApp";

export const metadata = { title: "Your crunch map — CrunchMap" };
export const dynamic = "force-dynamic";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: deadlines }, { data: source }] = await Promise.all([
    supabase
      .from("bb_deadlines")
      .select("id, title, due_at, type, course, done, source, created_at")
      .order("due_at", { ascending: true }),
    supabase.from("bb_calendar_sources").select("ics_url, last_synced_at").maybeSingle(),
  ]);

  return (
    <CrunchApp
      userId={user.id}
      initialDeadlines={(deadlines ?? []) as Deadline[]}
      // Only a masked version of the private calendar link ever reaches the browser.
      initialSource={source ? { masked: maskUrl(source.ics_url), lastSyncedAt: source.last_synced_at } : null}
    />
  );
}
