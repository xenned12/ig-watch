# Reel Intel

Compares a client's top Instagram reels with competitors' top reels in the same niche, then writes recommendations and short-form scripts.

Stack: Next.js 16, Supabase (Postgres + Realtime), Apify (Instagram scraper), OpenAI (structured output).

## Setup

1. Install dependencies: `npm install`
2. Copy the env template: `cp .env.example .env.local`
3. Fill in `.env.local` (see the variable list below). Make sure `NEXT_PUBLIC_SUPABASE_ANON_KEY=` is present. It is missing from `.env.example` and must be added by hand.

### Environment variables

| Name | Scope | Notes |
| --- | --- | --- |
| `SCRAPER` | server only, optional | `apify` (default) or `instaloader` (local only, see "Try Instaloader instead of Apify") |
| `APIFY_TOKEN` | server only | Apify API token. Not needed when `SCRAPER=instaloader` |
| `INSTALOADER_USERNAME` | server only, optional | Instagram account whose saved Instaloader session is used |
| `INSTALOADER_PYTHON` | server only, optional | Python with Instaloader installed. Default `.venv/bin/python` |
| `OPENAI_API_KEY` | server only | OpenAI API key |
| `OPENAI_MODEL` | server only | For example `gpt-4.1-mini` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Supabase service role key |
| `WEBHOOK_SECRET` | server only | Long random string, for example `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | public | Production URL, used for Apify webhook and job callbacks |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | server only, optional | Only needed if Vercel Deployment Protection is on. See "Deployment Protection" below |

Never commit `.env*` files with values. `.env.local` must stay in `.gitignore`.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

For local runs, `NEXT_PUBLIC_APP_URL` can be `http://localhost:3000`. Apify cannot reach localhost webhooks, so use a production or tunnel URL for full end-to-end runs.

### Try Instaloader instead of Apify (free, local only)

[Instaloader](https://instaloader.github.io/) is a free, open-source scraper. The app runs `scripts/instaloader_scrape.py` in the background; it writes posts in the same shape Apify returns and then calls the same webhook, so everything after scraping works the same.

1. Install it into a project-local Python environment:
   ```bash
   python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
   ```
2. Sign in once with an Instagram account (Instagram blocks logged-out scraping almost immediately). This saves a session file; you type the password yourself:
   ```bash
   .venv/bin/instaloader -l YOUR_INSTAGRAM_USERNAME
   ```
3. In `.env.local`, set `SCRAPER=instaloader` and `INSTALOADER_USERNAME=YOUR_INSTAGRAM_USERNAME`, then restart `npm run dev`. `APIFY_TOKEN` can stay empty.

Notes:
- Local only. Vercel functions can't run Python or keep a background process, so keep `SCRAPER=apify` in production.
- It's slower than Apify (Instaloader waits between requests) and has no proxy, so Instagram may rate-limit or flag the account you sign in with. Use a spare account, and keep runs small.
- Scraping without Meta's permission is against Instagram's terms.
- If Instagram refuses a request, the run lists that account as "Instagram blocked the request". The script's log is in your OS temp folder under `reel-intel-instaloader/`.

## Test

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`apify-client` is pinned to `2.20.0`. Newer versions pull in a high-severity advisory, so do not upgrade it without checking.

## Deploy and verify

1. **Apply the database migrations** to a hosted Supabase project, in order, or run `supabase db push`. In the SQL editor, run each file once; re-running an earlier one fails with `relation ... already exists`.
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_single_active_run.sql`
   3. `supabase/migrations/0003_run_started_at.sql`
   4. `supabase/migrations/0004_niche_top_accounts.sql`
   5. `supabase/migrations/0005_niche_top_accounts_pending.sql`
   6. `supabase/migrations/0006_run_date_range.sql`
   7. `supabase/migrations/0007_grant_service_role.sql`. Required on new Supabase projects, which no longer grant API roles access to tables created in SQL. Without it, every page fails with `permission denied for table runs`.

   A local Supabase in Docker cannot be reached from Vercel, so production needs its own hosted project.
2. **Check Realtime.** Progress updates use public broadcast channels (`run:<id>`). In Supabase, Realtime must stay on and its "Allow public access" setting must stay enabled. If public access is off, the run page cannot join the channel and falls back to refetching every 15 seconds.
3. **Set every env var in Vercel** (all required variables from the table above). Take the three Supabase values from the hosted project (Project Settings > API Keys; use the legacy `anon` and `service_role` keys, or the new publishable and secret keys, but not a mix). Set `NEXT_PUBLIC_APP_URL` to the production URL with no trailing slash, and keep `SCRAPER=apify` (Instaloader cannot run on Vercel). Keep Fluid compute on (the default for new Vercel projects): the analyze job needs up to 300 seconds. Then deploy. `vercel.json` pins the Next.js framework, so the build does not depend on the project's Framework Preset. Env var changes only apply to new deployments, so redeploy after changing them.
4. **Optional: Deployment Protection.** See "Deployment Protection" below. If you turn it on, set `VERCEL_AUTOMATION_BYPASS_SECRET` too, or the pipeline stops after the fetch step.
5. **Run one real analysis** with 4 public accounts in the same niche (for example AI).
   - Progress steps should update live.
   - Transcripts should appear for every kept post.
   - Results should show patterns, 3 to 5 recommendations whose links open real competitor posts, and 3 scripts.
6. **Check the Apify field names.** Copy one real item from the Apify dataset console and compare its fields with `tests/fixtures/apify-items.json` (`ownerUsername`, `type`/`productType`, `videoViewCount`/`videoPlayCount`, `likesCount`, `timestamp`, `videoDuration`, `videoUrl`, `url`). If they differ, update the schema and the fixture, then run `npm test`.
7. **Check OpenAI structured output.** Confirm that OpenAI accepts the structured-output schema (min/max item counts) on the first analysis.
8. **Check the concurrency lock.** While one analysis is running, start a second one. It should be refused with: `Another analysis is already running. Try again when it finishes.`

## Deployment Protection

The Apify webhook (`/api/webhooks/apify`) and the job routes (`/api/jobs/*`) are called by Apify and by the app itself, not by a browser. Deployment Protection must not block them. They are already guarded by `WEBHOOK_SECRET`.

- On the Hobby plan, standard protection only covers preview deployments, not production. Production is public, so nothing else is needed.
- If you enable protection that covers production (for example password protection or Vercel Authentication on all deployments), open Project Settings > Deployment Protection > Protection Bypass for Automation, create a secret and set it as `VERCEL_AUTOMATION_BYPASS_SECRET`. The app then sends it as the `x-vercel-protection-bypass` header on job calls and in the Apify webhook headers.

## How it works

- An analysis takes the client account and its competitor accounts, and pulls their top reels through Apify.
- Only video posts are analysed. Videos are not downloaded or stored; they are transcribed and only the transcripts are kept.
- Progress is broadcast over Supabase Realtime to the run page, which also refetches every 15 seconds as a fallback.
- OpenAI turns the transcripts and metrics into patterns, recommendations and scripts, using a structured-output schema.
- Results are stored in Supabase. Each recommendation links to the source competitor post.

## Limits

- One analysis at a time for the whole app.
- 5 analysis starts per IP per hour.
- A run stuck for more than 30 minutes is marked failed. It can be retried from the Runs page.
- Job routes answer right away and do their work in the background (`after()`). Each transcription job has up to 60 seconds; the analyze job has up to 300 seconds, which requires Fluid compute (the default on new Vercel projects).
- There is no login. Use Deployment Protection if the site is public.
