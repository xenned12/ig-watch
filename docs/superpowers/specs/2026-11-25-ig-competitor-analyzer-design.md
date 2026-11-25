# Instagram Competitor Analyzer — Design

Date: 2026-11-25
Status: Awaiting review

## Goal

The user enters 4–11 public Instagram accounts from one niche. One account is the client; the others are its competitors. The app:

1. Finds each account's top 10 posts from the last 90 days. "Top" means most views; if a post has no view count, likes are used instead.
2. Transcribes the speech in each post.
3. Sends the transcripts to an LLM.
4. Shows what the competitors' top posts have in common and how the client's posts differ.
5. Writes 3 new scripts for the client.

Keep it simple: one niche per run, no scheduling, no teams.

## Stack

| Concern | Choice |
|---|---|
| App + hosting | Next.js (App Router, TypeScript) on Vercel Hobby |
| Database, realtime, file storage | Supabase (no Supabase Auth; there are no user accounts) |
| Instagram data | Apify `apify/instagram-scraper` (free monthly credits) |
| Transcription | OpenAI Whisper (`whisper-1`) |
| Analysis + scripts | OpenAI GPT, structured JSON output (model set by env var) |
| Validation | Zod on every request body, webhook payload and LLM response |

Secrets live only in Vercel environment variables, never in the browser or the repo: `APIFY_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`. A committed `.env.example` lists them, and `.env*` is in `.gitignore`.

## Screens

The approved clickable prototype is [design/reel-intel-prototype.html](../../../design/reel-intel-prototype.html), with demo data. It is the visual reference for every screen below.

### Design system

- **Style:** a data-dense dashboard, from the ui-ux-pro-max design system.
- **Fonts:** Fira Sans for text; Fira Code for numbers and handles, with tabular figures so they line up.
- **Color:** blue (`#1E40AF` light, `#8DB4FF` dark) means competitors and primary actions. Amber (`#B45309` light, `#F5B94A` dark) always means the client. Green, red and amber pills show status.
- **Themes:** light and dark, both from the same CSS tokens.
- **Accessibility:** visible focus rings, tap targets of at least 40px, and errors shown next to their field. Reduced motion turns off animation. Phone layout works down to about 400px wide; there the sidebar becomes a top bar.
- **Shell:** a sidebar with New analysis, Latest results, Runs and recent runs. There is no login and no user menu; anyone who opens the app uses it directly, and the app opens on Latest results (or New analysis when there are no runs yet).

### Screens

1. **New analysis** (`/new`).
   - **Niche:** AI, Business, Finance, Gaming or Crypto, chosen with buttons.
   - **Client handle:** checked when the user leaves the field.
   - **Competitors:** 3–10 handles entered as tags with Enter or a comma.
     - Pasting a handle or a full instagram.com URL works.
     - Backspace removes the last tag.
     - Errors show next to the field: invalid handle, duplicate, client also listed as a competitor, or too few or too many.
   - **Summary panel:** number of accounts, 90-day window, top 10 videos each, ranked by views (else likes), and estimated time. It also says only video posts are fetched and nothing is downloaded.
2. **Run progress** (`/runs/[id]` while running).
   - **Steps:** Fetch → Rank → Transcribe (with an x/40 counter and progress bar) → Analyze → Write scripts, updated live through Supabase Realtime.
   - An activity log, and a note that the user can leave the page.
   - Moves to the results on its own when done.
3. **Results** (`/runs/[id]`).
   - **Header:** niche, date and window, plus Re-run and View scripts buttons.
   - **Summary numbers:** competitor and client median views (with the % gap), average reel length, and the share of reels with a bold claim in the first 2 seconds, comparing competitors with the client.
   - Three tabs, switchable with the arrow keys:
     - **Overview:**
       - a bar chart of median views by account, with the client in amber and a legend
       - a "How the client differs" list, with each item marked Gap or Keep
       - a "Similar patterns" table: each pattern scored out of 10 for competitors and for the client, with mini bars
       - 3–5 recommendations, each with a one-line reason and a link to the winning post behind it, which opens the post pop-up
       - data notes, such as a post ranked by likes or a transcript taken from the caption
     - **Posts and transcripts:** for every account, it shows how many video posts were found in the 90 days and says only the top 10 by views are kept.
       - Filters: all accounts, competitors, or one account.
       - Search inside transcripts, with matches highlighted (search waits 180 ms after typing stops).
       - Sort by most views, newest or longest.
       - Each row shows rank, handle, date, length, views (or likes) and a 2-line transcript preview.
       - "Show 10 more" loads more rows. A search with no matches suggests other words and offers to clear the search.
     - **Scripts:** 3 cards, each with length, name, hook and the patterns it uses.
4. **Runs** (`/runs`).
   - A table with client, niche, competitors, posts, status and date.
   - Finished runs open their results. Failed runs show the reason and a "Retry the failed step" link.

### Pop-ups

- **Post pop-up:**
  - handle (with a Client badge on client posts), rank for the account, date and length
  - views, likes, comments, and the number it was ranked by
  - the transcript with timestamps, labelled as coming from Whisper or from the caption
  - Copy transcript, Prev and Next (also ← and →), and **Open on Instagram**, which is a link only; videos are never downloaded
  - Opened from the posts list, Prev and Next follow the current filter. Opened from a recommendation, they move through that account's posts.
- **Script pop-up:** the hook, timed beats, the call to action, Prev and Next, and Copy script.
- **Both pop-ups:**
  - Esc, the close button or clicking outside closes them.
  - Keyboard focus stays inside while open and goes back to where the user was afterwards.
  - The page behind doesn't scroll.
  - If copying is blocked, a message tells the user to select the text and copy it instead.

## Pipeline

Each step is a short serverless call, so none comes near Vercel's time limit. A run's `status` in the database is the single source of truth, and the UI subscribes to it through Supabase Realtime.

1. **Start** (`POST /api/runs`):
   - Validates the input with Zod and normalises the handles.
   - Inserts a `runs` row with status `fetching`.
   - Starts one Apify actor run for all handles, limited to the last 90 days, passing a webhook URL with the run id and `WEBHOOK_SECRET`.
2. **Apify finished** (`POST /api/webhooks/apify`):
   - Checks the secret (rejects with 401 if it's wrong).
   - Downloads the dataset.
   - Ranks the posts. Only video posts (reels and video posts) are fetched and kept; image posts and carousels are skipped, because they have no speech to transcribe. Apify is asked for reels first to save credits. Posts are sorted by `videoViewCount ?? videoPlayCount`, or by `likesCount` if neither exists, and the top 10 per account are stored in `posts`.
   - Accounts that are private, missing or have no videos are recorded on the run with a reason.
   - Sets status to `transcribing` and starts one transcribe job per post.
3. **Transcribe** (`POST /api/jobs/transcribe`, one call per post, protected by an internal secret):
   - Downloads the video, sends it to Whisper (25 MB limit) and saves the transcript.
   - If there's no speech or the download fails, it retries once and then falls back to the post's caption, marked `source = caption`.
   - The last post to finish (an atomic count of remaining posts) starts the analysis step.
4. **Analyze** (`POST /api/jobs/analyze`) makes two GPT calls:
   - Call A: the competitor transcripts plus their view counts → shared patterns (hook style, topic, structure, length, CTA, tone). Each pattern lists the posts that show it, by id.
   - Call B: the client transcripts plus those patterns → the client's gaps and strengths; 3–5 short recommendations, each naming the post id of the winning competitor post behind it (the app checks that the post exists); and 3 scripts in the client's voice. Each script has a hook, body, CTA, a target length and the patterns it uses.
   - Both outputs are checked with Zod and saved to `analyses`; status becomes `done`.

Every step can be run again: re-running it for a run overwrites that step's rows. If a step fails, the run's status becomes `failed` with a short message the user can read (no stack traces), and a "Retry" button runs the failed step again.

## Data model (Supabase Postgres)

- `runs`: id, niche, client_handle, competitor_handles[], status, error, skipped_accounts jsonb, created_at
- `posts`: id, run_id, handle, is_client, ig_url, posted_at, views, likes, rank_metric (`views` | `likes`), rank, video_url, caption
- `transcripts`: post_id, text, segments jsonb (`[{start_s, text}]` from Whisper `verbose_json`; empty for captions), source (`whisper` | `caption`)
- `posts` also stores comments; `runs` also stores `videos_found` jsonb (handle → number of video posts found in the 90 days), for the "found vs kept" line
- `posts` also stores duration_s
- `analyses`: run_id, patterns jsonb, gaps jsonb, recommendations jsonb (text + source post_id), scripts jsonb

Row-level security is on for every table with no public policies, so the browser can't read or write tables directly. All reads and writes go through the app's server routes using the service role key. Realtime progress uses a broadcast channel per run id that only carries step status.

## Security

There is no login: everyone who can reach the app can see every run and start new ones. To keep it from spending API credits without limit:

- Only 1 run can be in progress at a time across the whole app; a second start gets a 409 with a clear message.
- `POST /api/runs` is rate-limited per IP (5 runs per hour).
- Optional: turn on Vercel Deployment Protection (password or Vercel login) for the whole site, if the link may be shared beyond the team. This needs no app code.
- The webhook and job routes are checked against shared secrets, compared with a timing-safe check; a wrong secret gets 401.
- Inputs are validated with Zod, and error responses never include internal details.
- Secrets stay server-side only.

## Testing

- Unit tests:
  - ranking, including the likes fallback and accounts with fewer than 10 videos
  - normalising handles
  - Zod schemas for the Apify payload and both LLM outputs, using saved sample data
- Integration test: the webhook → rank → stored posts flow, using a saved Apify payload.
- One manual end-to-end run with 4 real public accounts.

## Out of scope

Scheduling, carousels without audio, languages other than English (Whisper detects the language automatically, and that's left as is), teams and sharing, and billing.
