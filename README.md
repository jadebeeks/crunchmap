# CrunchMap

CrunchMap helps IE undergrads import their Blackboard deadlines and spot clash weeks so they start early, not at 2am.

Student project, not affiliated with IE University.

## Setup

1. **Database:** Supabase Dashboard → your project → **SQL Editor** → **New query** → paste `supabase/schema.sql` → **Run**.
   It only creates `bb_deadlines`, `bb_calendar_sources` and `bb_ignore_rules` (with Row Level Security) and touches no other table.
   Already ran the first version? Run just `supabase/ignore_rules.sql` the same way.
2. **Auth:** Supabase Dashboard → **Authentication** → **Sign In / Providers** → **Email** → turn **off** "Confirm email" → Save.
3. **Keys:** `.env.local` (never committed) needs:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
   Add the same two variables in Vercel → Project → Settings → Environment Variables. No service_role/secret key is used anywhere.

## Run locally (port 3001)

```bash
npm install
npm run dev:3001
```

Open http://localhost:3001. Run the tests with `npm test`.

## How the import works

`POST /api/import` runs on the Node runtime with the logged-in user's session cookies, so RLS applies. It reads the user's saved link,
accepts only `https://blackboard.ie.edu/…/*.ics`, fetches it (10 s timeout, 2 MB cap, redirects only within Blackboard), and upserts
events from today (Europe/Madrid) to 180 days ahead on `(user_id, external_uid)` without touching `done`. `/app` re-syncs automatically when the
last sync is older than 4 hours.

Class sessions are skipped by `lib/classify.ts`: deadline words win; Blackboard gradable items and zero-length entries are
deadlines; IE timetable IDs, session words and short timed events with a room are classes; long non-class entries are
imported as "Admin" dates that don't count in the crunch map. "This is a class" saves a per-user rule in `bb_ignore_rules`.
