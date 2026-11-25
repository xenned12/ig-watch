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
| `APIFY_TOKEN` | server only | Apify API token |
| `OPENAI_API_KEY` | server only | OpenAI API key |
| `OPENAI_MODEL` | server only | For example `gpt-4.1-mini` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Supabase service role key |
| `WEBHOOK_SECRET` | server only | Long random string, for example `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | public | Production URL, used for Apify webhook and job callbacks |

Never commit `.env*` files with values. `.env.local` must stay in `.gitignore`.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

For local runs, `NEXT_PUBLIC_APP_URL` can be `http://localhost:3000`. Apify cannot reach localhost webhooks, so use a production or tunnel URL for full end-to-end runs.

## Test

```bash
npm run typecheck
npm test
npm run build
```

Known issue: `npm run lint` currently fails with an ESLint config error after the Next 16 upgrade. Lint is not part of the checks above.

`apify-client` is pinned to `2.20.0`. Newer versions pull in a high-severity advisory, so do not upgrade it without checking.

## Deploy and verify

1. **Apply the database migrations** in the Supabase SQL editor, in order, or run `supabase db push`:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_single_active_run.sql`
   3. `supabase/migrations/0003_run_started_at.sql`
2. **Check Realtime.** Realtime is enabled by default in Supabase. Confirm it is still on for the project, since progress updates use broadcast channels.
3. **Set every env var in Vercel** (all variables from the table above). Set `NEXT_PUBLIC_APP_URL` to the production URL. Then deploy.
4. **Optional: enable Vercel Deployment Protection** (password) for the whole site. The app has no login.
5. **Run one real analysis** with 4 public accounts in the same niche (for example AI).
   - Progress steps should update live.
   - Transcripts should appear for every kept post.
   - Results should show patterns, 3 to 5 recommendations whose links open real competitor posts, and 3 scripts.
6. **Check the Apify field names.** Copy one real item from the Apify dataset console and compare its fields with `tests/fixtures/apify-items.json` (`ownerUsername`, `type`/`productType`, `videoViewCount`/`videoPlayCount`, `likesCount`, `timestamp`, `videoDuration`, `videoUrl`, `url`). If they differ, update the schema and the fixture, then run `npm test`.
7. **Check OpenAI structured output.** Confirm that OpenAI accepts the structured-output schema (min/max item counts) on the first analysis.
8. **Check the concurrency lock.** While one analysis is running, start a second one. It should be refused with: `Another analysis is already running. Try again when it finishes.`

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
- Routes use `maxDuration = 60`, which is the Vercel Hobby limit per request.
- There is no login. Use Deployment Protection if the site is public.
