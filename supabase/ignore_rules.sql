-- CrunchMap "This is a class" rules. Only creates/changes bb_ignore_rules.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run. Safe to run more than once.

create table if not exists public.bb_ignore_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern text not null,
  created_at timestamptz default now(),
  unique (user_id, pattern)
);

alter table public.bb_ignore_rules enable row level security;

drop policy if exists "bb_ignore_rules_select_own" on public.bb_ignore_rules;
drop policy if exists "bb_ignore_rules_insert_own" on public.bb_ignore_rules;
drop policy if exists "bb_ignore_rules_update_own" on public.bb_ignore_rules;
drop policy if exists "bb_ignore_rules_delete_own" on public.bb_ignore_rules;

create policy "bb_ignore_rules_select_own" on public.bb_ignore_rules
  for select to authenticated using (auth.uid() = user_id);
create policy "bb_ignore_rules_insert_own" on public.bb_ignore_rules
  for insert to authenticated with check (auth.uid() = user_id);
create policy "bb_ignore_rules_update_own" on public.bb_ignore_rules
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bb_ignore_rules_delete_own" on public.bb_ignore_rules
  for delete to authenticated using (auth.uid() = user_id);
