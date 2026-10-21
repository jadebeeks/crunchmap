-- CrunchMap schema. Only creates/changes bb_deadlines, bb_calendar_sources and bb_ignore_rules.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run. Safe to run more than once.

create table if not exists public.bb_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  due_at timestamptz not null default now() + interval '7 days',
  type text default 'Assignment',
  course text,
  done boolean default false,
  source text default 'manual',
  external_uid text,
  created_at timestamptz default now(),
  unique (user_id, external_uid)
);

create index if not exists bb_deadlines_user_due_idx on public.bb_deadlines (user_id, due_at);

create table if not exists public.bb_calendar_sources (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ics_url text not null,
  last_synced_at timestamptz
);

alter table public.bb_deadlines enable row level security;
alter table public.bb_calendar_sources enable row level security;

-- bb_deadlines: owner-only policies
drop policy if exists "bb_deadlines_select_own" on public.bb_deadlines;
drop policy if exists "bb_deadlines_insert_own" on public.bb_deadlines;
drop policy if exists "bb_deadlines_update_own" on public.bb_deadlines;
drop policy if exists "bb_deadlines_delete_own" on public.bb_deadlines;

create policy "bb_deadlines_select_own" on public.bb_deadlines
  for select to authenticated using (auth.uid() = user_id);
create policy "bb_deadlines_insert_own" on public.bb_deadlines
  for insert to authenticated with check (auth.uid() = user_id);
create policy "bb_deadlines_update_own" on public.bb_deadlines
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bb_deadlines_delete_own" on public.bb_deadlines
  for delete to authenticated using (auth.uid() = user_id);

-- bb_calendar_sources: owner-only policies
drop policy if exists "bb_calendar_sources_select_own" on public.bb_calendar_sources;
drop policy if exists "bb_calendar_sources_insert_own" on public.bb_calendar_sources;
drop policy if exists "bb_calendar_sources_update_own" on public.bb_calendar_sources;
drop policy if exists "bb_calendar_sources_delete_own" on public.bb_calendar_sources;

create policy "bb_calendar_sources_select_own" on public.bb_calendar_sources
  for select to authenticated using (auth.uid() = user_id);
create policy "bb_calendar_sources_insert_own" on public.bb_calendar_sources
  for insert to authenticated with check (auth.uid() = user_id);
create policy "bb_calendar_sources_update_own" on public.bb_calendar_sources
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bb_calendar_sources_delete_own" on public.bb_calendar_sources
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------

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
