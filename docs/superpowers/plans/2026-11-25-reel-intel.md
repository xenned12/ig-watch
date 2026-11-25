# Reel Intel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app on Vercel. The user enters a client plus 3–10 competitor Instagram accounts. The app pulls each account's top 10 video posts from the last 90 days, transcribes them, compares them with GPT, and shows patterns, gaps, recommendations, transcripts and 3 scripts.

**Architecture:** The pipeline is a chain of short serverless calls:
- `POST /api/runs` starts an Apify run.
- When Apify finishes, it calls the webhook, which ranks the posts and sends out one transcribe job per post.
- The last transcribe job to finish starts the analyze job.

All pipeline logic lives in `lib/pipeline/*` as plain functions that receive their services as arguments (`Deps`: store, Apify, OpenAI, a job sender, a progress emitter). Route handlers stay thin, and tests run against an in-memory store with fake services. The UI reads only through the app's own API routes, plus a Supabase Realtime broadcast channel per run that carries progress.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), React 19, Supabase (Postgres plus Realtime broadcast; no Auth), `@supabase/supabase-js`, `apify-client`, `openai`, `zod`, Vitest plus `@testing-library/react`, `next/font/google` (Fira Sans and Fira Code), plain CSS with tokens copied from the prototype.

**Spec:** `docs/superpowers/specs/2026-11-25-ig-competitor-analyzer-design.md`. Visual reference: `design/reel-intel-prototype.html`. Copy markup structure, class names, tokens and wording from the prototype wherever a UI task says "as in the prototype".

## Global Constraints

- 4–11 accounts per run: 1 client plus 3–10 competitors. A handle matches `^[a-z0-9._]{1,30}$` after normalising.
- Window: posts from the last 90 days. Only video posts are fetched and kept; image posts and carousels are skipped.
- "Top" means `videoViewCount ?? videoPlayCount`, and `likesCount` when neither exists. Keep the top 10 per account.
- Whisper model `whisper-1`, `response_format: "verbose_json"`; the file limit is 25 MB. The GPT model comes from `OPENAI_MODEL` and uses structured JSON output.
- Server-only secrets: `APIFY_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`. Public values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. `.env*` goes in `.gitignore`, except `.env.example`.
- No login. Only 1 run may be in progress across the whole app (a second start gets 409). `POST /api/runs` is limited to 5 per IP per hour (429).
- Webhook and job routes check `x-webhook-secret` with `crypto.timingSafeEqual`; a wrong or missing secret gets 401.
- Error bodies are `{ error: string }` in plain words. Never include a stack trace, SQL or provider message.
- Row-level security is on for every table, with no policies. Only the service role reads or writes.
- Every route that calls a provider exports `maxDuration = 60`.
- Run statuses: `fetching` → `transcribing` → `analyzing` → `done`, or `failed` with `failed_step` set to one of `fetch`, `transcribe` or `analyze`.
- UI copy, colors (blue `#1E40AF`/`#8DB4FF` for competitors and primary actions, amber `#B45309`/`#F5B94A` for the client), Fira fonts, light and dark themes, focus rings, 40px tap targets and reduced motion all follow the prototype.
- No `any` (use `unknown` and narrow it). No `console.log` in shipped code. Keep each file under 250 lines.

## Review Focus

1. **Handles typed in different shapes.** `@Promptpilot`, `promptpilot/`, `https://instagram.com/promptpilot?igsh=x` and `PROMPTPILOT` must all normalise to `promptpilot`. Duplicates and client/competitor clashes are caught after normalising. (Task 2)
2. **Apify sends the webhook twice** (it retries on timeouts). The second delivery must do nothing: no duplicate posts and no second set of transcribe jobs. (Task 7)
3. **The same transcribe job runs twice**, or two jobs finish at the same moment. The remaining count drops once per post, and analysis starts exactly once. (Task 8)
4. **Not enough usable accounts.** If accounts are private, missing or have no videos, and fewer than 3 competitors or a client with 0 videos are left, the run fails at the fetch step with a message naming the skipped handles. It must not transcribe a partial set. (Task 7)
5. **GPT returns a recommendation citing a post that doesn't exist**, or a client post, or returns malformed JSON. Bad citations are dropped. Malformed output gets one retry, then the run fails at the analyze step. A run with zero valid recommendations fails. (Task 9)

---

## File Structure

```
.env.example                      env names, no values
supabase/migrations/0001_init.sql tables, RLS, decrement function
lib/env.ts                        zod-validated server env
lib/handles.ts                    normaliseHandle, validateRunInput, tagError (shared by client and server)
lib/types.ts                      Run, Post, Transcript, Analysis, RunStatus, Step
lib/apify/schema.ts               ApifyItem zod schema
lib/rank.ts                       rankItems
lib/store/types.ts                Store interface
lib/store/memory.ts               in-memory Store (tests)
lib/store/supabase.ts             Supabase Store
lib/security.ts                   checkSecret, hashIp
lib/progress.ts                   Progress interface and Supabase broadcast implementation
lib/jobs.ts                       sendJob (server-to-server POST with secret)
lib/pipeline/deps.ts              Deps type, makeDeps() for production (Apify and OpenAI wiring)
lib/pipeline/start.ts             startRun
lib/pipeline/webhook.ts           handleApifyDone
lib/pipeline/transcribe.ts        transcribePost
lib/pipeline/analyze.ts           analyzeRun, prompts and output schemas
lib/pipeline/retry.ts             retryRun
lib/view.ts                       pure results-view helpers
app/api/runs/route.ts             POST create, GET list
app/api/runs/[id]/route.ts        GET run detail
app/api/runs/[id]/retry/route.ts  POST retry
app/api/webhooks/apify/route.ts
app/api/jobs/transcribe/route.ts
app/api/jobs/analyze/route.ts
app/globals.css                   tokens and base styles from the prototype
app/layout.tsx, app/page.tsx
app/_components/Shell.tsx, Modal.tsx, Icon.tsx, Toast.tsx
app/new/page.tsx, app/new/_components/NewRunForm.tsx, HandleTags.tsx
app/runs/page.tsx
app/runs/[id]/page.tsx
app/runs/[id]/_components/RunProgress.tsx, Results.tsx, OverviewTab.tsx, PostsTab.tsx, ScriptsTab.tsx, PostModal.tsx, ScriptModal.tsx
tests/fakes.ts
tests/fixtures/apify-items.json, gpt-patterns.json, gpt-compare.json
tests/**/*.test.ts(x)
```

---

### Task 1: Project scaffold

**Files:**
- Create: the Next.js app in the repo root, `vitest.config.ts`, `.env.example`, `lib/env.ts`, `tests/env.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `serverEnv(): { APIFY_TOKEN; OPENAI_API_KEY; OPENAI_MODEL; SUPABASE_SERVICE_ROLE_KEY; WEBHOOK_SECRET; NEXT_PUBLIC_SUPABASE_URL; NEXT_PUBLIC_APP_URL }`, all strings. It is parsed with zod and throws `Missing server configuration: <NAME>` naming the first missing variable.
  - npm scripts `dev`, `build`, `test` (`vitest run`) and `typecheck` (`tsc --noEmit`).

- [ ] **Step 1:** Run `git init`. Then run `npx create-next-app@15 . --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*"`, keeping the existing `docs/` and `design/` folders. Expected: `npm run build` passes.
- [ ] **Step 2:** Add the dependencies: `zod @supabase/supabase-js apify-client openai server-only`, and as dev dependencies `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event`. Write `vitest.config.ts` with the `@` alias, the `jsdom` environment for `*.test.tsx`, and an alias that maps `server-only` to an empty module.
- [ ] **Step 3:** Write `.env.example` listing every name from Global Constraints with empty values, plus `OPENAI_MODEL=gpt-4.1-mini`. Make sure `.gitignore` contains `.env*` and `!.env.example`.
- [ ] **Step 4: Write the failing test** in `tests/env.test.ts`:
```ts
it('names the first missing variable', () => {
  vi.stubEnv('APIFY_TOKEN', '');
  expect(() => serverEnv()).toThrow('Missing server configuration: APIFY_TOKEN');
});
```
- [ ] **Step 5:** Run `npm test`. Expected: FAIL, because `serverEnv` isn't defined yet.
- [ ] **Step 6:** Implement `lib/env.ts` with `import 'server-only'` at the top. Run `npm test`. Expected: PASS.
- [ ] **Step 7:** Commit with `git add -A` and the message `chore: scaffold next app with test tooling`.

### Task 2: Handle normalisation and run input validation

**Files:**
- Create: `lib/handles.ts`, `tests/handles.test.ts`

**Interfaces:**
- Produces:
  - `type Niche = 'AI'|'Business'|'Finance'|'Gaming'|'Crypto'`
  - `HANDLE_RE = /^[a-z0-9._]{1,30}$/`
  - `normaliseHandle(raw: string): string`
  - `validateRunInput(input: unknown): { ok: true; value: { niche: Niche; client: string; competitors: string[] } } | { ok: false; errors: { niche?: string; client?: string; competitors?: string } }`
  - `tagError(h: string, client: string, existing: string[]): string | null`: the per-tag check the form uses while typing

  The messages are the prototype's wording:
  - `"Enter the client's Instagram handle."`
  - `"That isn't a valid handle. Use letters, numbers, dots or underscores."`
  - `` `@${h} is also in the competitor list. Remove it there first.` `` (client field)
  - `` `@${h} is already the client.` `` (tag)
  - `` `@${h} is already in the list.` ``
  - `` `Add ${n} more competitor${n===1?'':'s'}. You need 3 to 10.` ``
  - `'You can compare up to 10 competitors.'`

- [ ] **Step 1: Write the failing tests**:
```ts
it.each(['@Promptpilot','promptpilot/','https://instagram.com/promptpilot?igsh=x','https://www.instagram.com/PROMPTPILOT/reels/',' PROMPTPILOT '])
  ('normalises %s', raw => expect(normaliseHandle(raw)).toBe('promptpilot'));
it('rejects a duplicate after normalising', () =>
  expect(validateRunInput({ niche:'AI', client:'me', competitors:['a1','@A1','b2','c3'] }))
    .toEqual({ ok:false, errors:{ competitors:'@a1 is already in the list.' } }));
it('rejects client listed as competitor', () =>
  expect(validateRunInput({ niche:'AI', client:'@Me', competitors:['me','b','c'] }))
    .toMatchObject({ ok:false, errors:{ client:'@me is also in the competitor list. Remove it there first.' } }));
it('needs 3 competitors', () =>
  expect(validateRunInput({ niche:'AI', client:'me', competitors:['a'] }))
    .toMatchObject({ ok:false, errors:{ competitors:'Add 2 more competitors. You need 3 to 10.' } }));
it('caps at 10', () =>
  expect(validateRunInput({ niche:'AI', client:'me', competitors:Array.from({length:11},(_,i)=>'c'+i) }))
    .toMatchObject({ ok:false, errors:{ competitors:'You can compare up to 10 competitors.' } }));
it('rejects an unknown niche', () =>
  expect(validateRunInput({ niche:'Food', client:'me', competitors:['a','b','c'] })).toMatchObject({ ok:false }));
it('tagError flags the client', () => expect(tagError('me','me',[])).toBe('@me is already the client.'));
it('accepts and returns normalised values', () =>
  expect(validateRunInput({ niche:'AI', client:'@Me', competitors:['A','b','c'] }))
    .toEqual({ ok:true, value:{ niche:'AI', client:'me', competitors:['a','b','c'] } }));
```
- [ ] **Step 2:** Run `npx vitest run tests/handles.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `lib/handles.ts`. Steps in order: trim; remove a leading `https?://(www.)?instagram.com/` (case-insensitive) and a leading `@`; cut everything from the first `/`, `?` or `#`; lowercase. This file has no server imports, because the form uses it too.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: handle normalisation and run input validation`.

### Task 3: Database schema and Store

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `lib/types.ts`, `lib/store/types.ts`, `lib/store/memory.ts`, `lib/store/supabase.ts`, `tests/store.memory.test.ts`

**Interfaces:**
- Produces (`lib/types.ts`):
  - `RunStatus = 'fetching'|'transcribing'|'analyzing'|'done'|'failed'`
  - `Step = 'fetch'|'transcribe'|'analyze'`
  - `Run { id; niche; clientHandle; competitorHandles: string[]; status: RunStatus; failedStep: Step|null; error: string|null; skipped: {handle:string;reason:string}[]; videosFound: Record<string,number>; remaining: number; apifyRunId: string|null; createdAt: string }`
  - `Post { id; runId; handle; isClient: boolean; igUrl; postedAt; views: number|null; likes: number; comments: number; durationS: number; rankMetric: 'views'|'likes'; rank: number; videoUrl: string|null; caption: string }`
  - `Transcript { postId; text; segments: {startS:number;text:string}[]; source: 'whisper'|'caption' }`
  - `Analysis { runId; patterns: Pattern[]; gaps: Gap[]; recommendations: Recommendation[]; scripts: Script[] }`, where:
    - `Pattern { name; competitorCount: number; clientCount: number; postIds: string[] }`
    - `Gap { text; kind: 'gap'|'keep' }`
    - `Recommendation { text; reason; postId }`
    - `Script { name; lengthS: number; patterns: string[]; hook; beats: {at:string;text:string}[]; cta }`
- Produces (`Store` in `lib/store/types.ts`):
  - `createRun(r: { niche; clientHandle; competitorHandles }): Promise<Run>`: status `fetching`
  - `getRun(id): Promise<Run|null>`
  - `listRuns(): Promise<(Run & {postCount:number})[]>`, newest first
  - `activeRun(): Promise<Run|null>`: any run whose status is not `done` or `failed`
  - `updateRun(id, patch: Partial<Run>): Promise<void>`
  - `transitionRun(id, from: RunStatus, patch: Partial<Run>): Promise<boolean>`: updates only if the status is currently `from`, and returns whether it did
  - `replacePosts(runId, posts: Omit<Post,'id'|'runId'>[]): Promise<Post[]>`
  - `listPosts(runId): Promise<Post[]>`
  - `getPost(id): Promise<Post|null>`
  - `saveTranscriptOnce(t: Transcript): Promise<boolean>`: true only on the first insert for that post
  - `listTranscripts(runId): Promise<Transcript[]>`
  - `decrementRemaining(runId): Promise<number>`: atomic, and returns the new value
  - `saveAnalysis(a: Analysis): Promise<void>`: upsert
  - `getAnalysis(runId): Promise<Analysis|null>`
  - `addEvent(runId, message): Promise<void>`
  - `listEvents(runId): Promise<{at:string;message:string}[]>`
  - `countRecentStarts(ipHash, sinceIso): Promise<number>`
  - `recordStart(ipHash): Promise<void>`
- Produces: `memoryStore(): Store` and `supabaseStore(): Store`.

- [ ] **Step 1:** Write `0001_init.sql`.
  - Tables:
    - `runs`: snake_case columns matching `Run`; `remaining int not null default 0`; `status` with a check constraint over the 5 statuses.
    - `posts`
    - `transcripts`: `post_id` primary key, which is what makes `saveTranscriptOnce` work
    - `analyses`: `run_id` primary key
    - `run_events`
    - `run_starts`: `ip_hash`, `created_at`
  - `enable row level security` on all of them, with no policies.
  - The atomic decrement:
```sql
create function decrement_remaining(p_run uuid) returns int language sql as $$
  update runs set remaining = remaining - 1 where id = p_run returning remaining $$;
```
- [ ] **Step 2: Write the failing tests** for `memoryStore` covering the two behaviours the pipeline depends on:
```ts
it('saveTranscriptOnce is true only the first time', async () => {
  const s = memoryStore(); const t = { postId:'p1', text:'x', segments:[], source:'whisper' as const };
  expect(await s.saveTranscriptOnce(t)).toBe(true);
  expect(await s.saveTranscriptOnce(t)).toBe(false);
});
it('transitionRun only moves from the expected status', async () => {
  const s = memoryStore(); const r = await s.createRun({ niche:'AI', clientHandle:'me', competitorHandles:['a','b','c'] });
  expect(await s.transitionRun(r.id,'fetching',{status:'transcribing'})).toBe(true);
  expect(await s.transitionRun(r.id,'fetching',{status:'transcribing'})).toBe(false);
});
```
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement `memoryStore` with Maps and `supabaseStore` with the service-role client (`import 'server-only'`).
  - `transitionRun` is `update … where id=? and status=? returning id`.
  - `saveTranscriptOnce` is an `upsert` with `{ onConflict:'post_id', ignoreDuplicates:true }` and `.select()`, which returns whether a row came back.
  - `decrementRemaining` calls `rpc('decrement_remaining')`.
- [ ] **Step 5:** Run the tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: database schema and store`.

### Task 4: Ranking Apify items

**Files:**
- Create: `lib/apify/schema.ts`, `lib/rank.ts`, `tests/fixtures/apify-items.json`, `tests/rank.test.ts`

**Interfaces:**
- Produces:
  - `ApifyItemSchema`: zod with `.passthrough()`. Optional fields: `inputUrl`, `ownerUsername`, `type` (`'Video'|'Image'|'Sidecar'`), `productType`, `url`, `timestamp`, `videoViewCount`, `videoPlayCount`, `likesCount`, `commentsCount`, `videoDuration`, `videoUrl`, `caption`, `error`, `errorDescription`
  - `rankItems(items: unknown[], handles: { client: string; competitors: string[] }, now: Date): { posts: Omit<Post,'id'|'runId'>[]; videosFound: Record<string,number>; skipped: {handle:string;reason:string}[] }`

- [ ] **Step 1:** Write `tests/fixtures/apify-items.json`, shaped like `apify/instagram-scraper` output:
  - `alpha`: 13 videos, one of them 91 days old, plus 2 `Image` and 1 `Sidecar`
  - `beta`: 4 videos, one with no view fields and `likesCount: 9000`, which is higher than the other three's view counts
  - `delta`: 3 videos
  - `gamma`: one item `{ inputUrl, error:'not_found' }`
  - `zeta`: 2 `Image` items only
  - the client `me`: 2 videos

  Task 15 replaces the field names with a real dataset item's if they differ.
- [ ] **Step 2: Write the failing tests**:
```ts
const now = new Date('2026-11-25T00:00:00Z');
const r = rankItems(items, { client:'me', competitors:['alpha','beta','gamma','zeta'] }, now);
it('keeps top 10 videos in window, by views', () => {
  const a = r.posts.filter(p => p.handle==='alpha');
  expect(a.map(p=>p.rank)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  expect(a[0].views! >= a[9].views!).toBe(true);
});
it('counts videos found in the window', () => expect(r.videosFound).toMatchObject({ alpha:12, beta:4, me:2 }));
it('ranks a likes-only post by its likes', () => {
  const b = r.posts.filter(p => p.handle==='beta');
  expect(b[0]).toMatchObject({ views:null, rankMetric:'likes', rank:1 });
});
it('records skipped accounts with a reason', () => expect(r.skipped).toEqual([
  { handle:'gamma', reason:'Account not found or private' },
  { handle:'zeta', reason:'No video posts in the last 90 days' } ]));
it('marks the client', () => expect(r.posts.filter(p=>p.isClient).map(p=>p.handle)).toEqual(['me','me']));
```
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement `rankItems`.
  - Assign each item to a handle by `ownerUsername`, or else by `normaliseHandle(inputUrl)`. Ignore items whose handle isn't in the run.
  - Keep only items where `type==='Video'` or `productType==='clips'`, with `timestamp` within 90 days of `now`.
  - The sort key is `views ?? likes`, descending, then `timestamp` descending.
  - `igUrl` is `item.url` and `durationS` is `Math.round(videoDuration ?? 0)`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: rank apify items into top 10 videos per account`.

### Task 5: Security helpers, progress, job sender and production deps

**Files:**
- Create: `lib/security.ts`, `lib/progress.ts`, `lib/jobs.ts`, `lib/pipeline/deps.ts`, `tests/security.test.ts`

**Interfaces:**
- Produces:
  - `checkSecret(header: string|null, expected: string): boolean`, using `timingSafeEqual` on equal-length buffers and returning false when the lengths differ or the header is null
  - `hashIp(ip: string): string`: SHA-256 of `ip + WEBHOOK_SECRET`, in hex
  - `type ProgressEvent = { step: Step|'done'|'failed'; message: string; transcribed?: number; total?: number }`
  - `interface Progress { emit(runId: string, e: ProgressEvent): Promise<void> }`
  - `supabaseProgress(store: Store): Progress`: does `store.addEvent(runId, e.message)`, then broadcasts `e` on channel `run:${runId}` with event `progress`, using the service client's `channel().send({ type:'broadcast', event:'progress', payload:e })`
  - `sendJob(path: '/api/jobs/transcribe'|'/api/jobs/analyze', body: object): Promise<void>`: POSTs to `NEXT_PUBLIC_APP_URL + path` with the `x-webhook-secret` header, and throws on a non-2xx response
  - `interface Deps { store: Store; progress: Progress; sendJob: typeof sendJob; apify: { start(handles: string[], runId: string): Promise<string>; items(apifyRunId: string): Promise<unknown[]> }; openai: { transcribe(file: Blob, name: string): Promise<{ text: string; segments: {start:number;text:string}[] }>; json<T>(schema: ZodType<T>, system: string, user: string): Promise<T> }; fetchVideo(url: string): Promise<Blob>; now(): Date }`
  - `makeDeps(): Deps`, the production wiring (`import 'server-only'`)

- [ ] **Step 1: Write the failing tests**: `checkSecret('abc','abc')` is true; `checkSecret('abd','abc')`, `checkSecret('ab','abc')` and `checkSecret(null,'abc')` are false. `hashIp('1.2.3.4')` gives the same value twice and never equals `'1.2.3.4'`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the files. For `makeDeps().apify.start`, use `apify-client`'s `actor('apify/instagram-scraper').start(input, { webhooks })`:
  - input: `{ directUrls: handles.map(h=>'https://www.instagram.com/'+h+'/'), resultsType:'posts', resultsLimit:60, onlyPostsNewerThan:'90 days' }`
  - webhooks: `[{ eventTypes:['ACTOR.RUN.SUCCEEDED','ACTOR.RUN.FAILED','ACTOR.RUN.TIMED_OUT','ACTOR.RUN.ABORTED'], requestUrl: APP_URL+'/api/webhooks/apify', payloadTemplate:'{"runId":"'+runId+'","eventType":{{eventType}},"apifyRunId":{{resource.id}}}', headersTemplate: JSON.stringify({'x-webhook-secret':WEBHOOK_SECRET}) }]`

  Then:
  - `apify.items` uses `run(apifyRunId).dataset().listItems()`.
  - `openai.transcribe` uses `audio.transcriptions.create({ model:'whisper-1', response_format:'verbose_json', file: toFile(blob,name) })`.
  - `openai.json` uses `chat.completions.parse` with `zodResponseFormat(schema,'out')`, and throws if `parsed` is null.
  - `fetchVideo` uses `fetch(url)` with a 20 s `AbortSignal.timeout`, and throws on a non-2xx response.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: secret check, progress events, job sender, deps`.

### Task 6: Start a run

**Files:**
- Create: `tests/fakes.ts`, `lib/pipeline/start.ts`, `app/api/runs/route.ts` (POST), `tests/pipeline.start.test.ts`

**Interfaces:**
- Consumes: `validateRunInput`, `Deps`.
- Produces:
  - `fakeDeps(overrides?: Partial<Deps>): Deps & { sent: {path:string;body:object}[]; events: ProgressEvent[] }`: built on `memoryStore`. `apify.start` returns `'apify-1'`. `sendJob` and `progress.emit` record into `sent` and `events`. `now()` returns `2026-11-25T00:00:00Z`. Every later pipeline test uses it.
  - `startRun(deps: Deps, input: unknown, ipHash: string): Promise<{ status: 201; runId: string } | { status: 400; errors: Record<string,string> } | { status: 409|429|502; error: string }>`

- [ ] **Step 1: Write the failing tests**:
```ts
it('creates a fetching run and stores the apify run id', async () => {
  const d = fakeDeps(); const res = await startRun(d, { niche:'AI', client:'me', competitors:['a','b','c'] }, 'ip1');
  expect(res.status).toBe(201);
  expect(await d.store.getRun((res as {runId:string}).runId)).toMatchObject({ status:'fetching', apifyRunId:'apify-1' });
});
it('409 while another run is active', async () => {
  const d = fakeDeps(); await startRun(d, ok, 'ip1');
  expect(await startRun(d, ok, 'ip2')).toEqual({ status:409, error:'Another analysis is already running. Try again when it finishes.' });
});
it('429 on the 6th start in an hour from one ip', async () => {
  // 5 prior recordStart('ip1') calls → { status:429, error:'You have started 5 analyses in the last hour. Try again later.' }
});
it('400 with field errors', async () =>
  expect(await startRun(fakeDeps(), { niche:'AI', client:'me', competitors:['a'] }, 'ip1'))
    .toEqual({ status:400, errors:{ competitors:'Add 2 more competitors. You need 3 to 10.' } }));
it('fails at fetch when apify start throws', async () => {
  // apify.start rejects → { status:502, error:'Could not start fetching posts. Try again.' }; run { status:'failed', failedStep:'fetch' }
});
```
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `startRun`. The order is:
  1. validate
  2. `countRecentStarts(ipHash, now-1h)`: 5 or more gives 429
  3. `activeRun()`: one found gives 409
  4. `recordStart`
  5. `createRun`
  6. `apify.start`
  7. `updateRun({apifyRunId})`
  8. `progress.emit({step:'fetch', message:'Run started for N accounts'})`
- [ ] **Step 4:** Write the `POST` in `app/api/runs/route.ts`. It reads the IP from the first entry of `x-forwarded-for` and calls `startRun(makeDeps(), await req.json().catch(()=>null), hashIp(ip))`, then answers with the result's status and the result minus `status`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: start run with validation, single-run lock and rate limit`.

### Task 7: Apify webhook, then rank, store and send transcribe jobs

**Files:**
- Create: `lib/pipeline/webhook.ts`, `app/api/webhooks/apify/route.ts`, `tests/pipeline.webhook.test.ts`

**Interfaces:**
- Consumes: `rankItems`, `Deps`.
- Produces: `handleApifyDone(deps: Deps, payload: unknown): Promise<void>`. The payload is zod `{ runId: uuid; eventType: string; apifyRunId: string }`; an invalid payload or unknown run is ignored.

- [ ] **Step 1: Write the failing tests** (`apify.items` returns the Task 4 fixture):
```ts
const p = (runId:string) => ({ runId, eventType:'ACTOR.RUN.SUCCEEDED', apifyRunId:'apify-1' });
it('stores ranked posts, sets remaining, sends one transcribe job per post', async () => {
  // run: client me, competitors alpha,beta,delta → 10+4+3+2 = 19 posts
  await handleApifyDone(d, p(runId));
  expect(await d.store.getRun(runId)).toMatchObject({ status:'transcribing', remaining:19, videosFound:{ alpha:12, beta:4, delta:3, me:2 } });
  expect(d.sent.filter(j=>j.path==='/api/jobs/transcribe')).toHaveLength(19);
});
it('is idempotent when apify delivers twice', async () => {
  await handleApifyDone(d, p(runId)); await handleApifyDone(d, p(runId));
  expect(d.sent).toHaveLength(19);
  expect(await d.store.listPosts(runId)).toHaveLength(19);
});
it('fails at fetch when fewer than 3 competitors are usable', async () => {
  // competitors alpha,gamma,zeta
  expect(await d.store.getRun(runId)).toMatchObject({ status:'failed', failedStep:'fetch',
    error:'Not enough usable accounts. Skipped: @gamma (Account not found or private), @zeta (No video posts in the last 90 days). Add other competitors and try again.' });
  expect(d.sent).toHaveLength(0);
});
it('fails at fetch when the client has no videos', async () => {
  // client zeta → error 'Your client @zeta has no video posts in the last 90 days.'
});
it('fails at fetch on ACTOR.RUN.FAILED', async () => {
  // eventType 'ACTOR.RUN.FAILED' → error 'Fetching posts from Instagram failed. Retry the failed step.'
});
```
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `handleApifyDone`.
  - Claim the run first with `transitionRun(runId,'fetching',{status:'transcribing'})`. If that returns false, return and do nothing; this is what makes duplicate deliveries harmless.
  - Then: a non-succeeded event fails the run → `apify.items` → `rankItems` → usable check (the client has at least 1 post and at least 3 competitors have posts) → `replacePosts` → `updateRun({ videosFound, skipped, remaining })` → emit `{step:'fetch'}` and `{step:'rank', message:'Kept the top 10 videos per account'}` → `sendJob('/api/jobs/transcribe',{postId})` for each post via `Promise.allSettled`.
  - Any failure does `updateRun({status:'failed', failedStep:'fetch', error})` with the copy from the tests (or `'Fetching posts from Instagram failed. Retry the failed step.'` for an unexpected throw), then emits `{step:'failed'}`.
- [ ] **Step 4:** Write the route: `checkSecret` (401) → `after(() => handleApifyDone(makeDeps(), body))` from `next/server` → respond 200 at once. Export `maxDuration = 60`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: apify webhook ranks posts and fans out transcription`.

### Task 8: Transcribe job

**Files:**
- Create: `lib/pipeline/transcribe.ts`, `app/api/jobs/transcribe/route.ts`, `tests/pipeline.transcribe.test.ts`

**Interfaces:**
- Consumes: `Deps`, `Store.saveTranscriptOnce`, `Store.decrementRemaining`, `Store.transitionRun`.
- Produces: `transcribePost(deps: Deps, postId: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**:
```ts
it('saves a whisper transcript with segments', async () => {
  // openai.transcribe → { text:'hi', segments:[{start:0,text:'hi'}] }
  expect(await transcriptOf(id)).toEqual({ postId:id, text:'hi', segments:[{startS:0,text:'hi'}], source:'whisper' });
});
it('falls back to caption after one retry when download fails', async () => {
  const fetchVideo = vi.fn().mockRejectedValue(new Error('403'));
  // fetchVideo called 2 times; transcript { source:'caption', text: post.caption, segments: [] }
});
it('uses the caption when the file is over 25 MB', async () => {
  // fetchVideo → new Blob([new Uint8Array(25*1024*1024+1)]); openai.transcribe not called; source 'caption'
});
it('uses the caption when whisper returns empty text', async () => {});
it('a duplicate job does not decrement twice', async () => {
  await transcribePost(d, id); await transcribePost(d, id);
  expect((await d.store.getRun(runId))!.remaining).toBe(before - 1);
});
it('the last post moves the run to analyzing and sends exactly one analyze job', async () => {
  await Promise.all(postIds.map(id => transcribePost(d, id)));
  expect(d.sent.filter(j=>j.path==='/api/jobs/analyze')).toEqual([{ path:'/api/jobs/analyze', body:{ runId } }]);
  expect((await d.store.getRun(runId))!.status).toBe('analyzing');
});
it('emits transcribed/total progress', async () => {
  // after first post of 19: events contains { step:'transcribe', transcribed:1, total:19, message:'Transcribed 1/19' }
});
```
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `transcribePost`.
  - Get the post and its run; return if the run isn't `transcribing`.
  - Try `fetchVideo` plus Whisper up to 2 times. Use the caption (`segments: []`) when the file is too big, both attempts fail, or the text is empty after trimming.
  - `saveTranscriptOnce`. Only if it returns true: `decrementRemaining`, then emit progress with `total = posts.length`.
  - When the remaining count reaches 0: `transitionRun(runId,'transcribing',{status:'analyzing'})`, and only if that returns true, emit `{step:'analyze', message:'Comparing transcripts'}` and `sendJob('/api/jobs/analyze',{runId})`.
- [ ] **Step 4:** Write the route: `checkSecret` (401), zod `{ postId: uuid }` (400 `{error:'Invalid job.'}`), `await transcribePost(makeDeps(), postId)`, respond 200, `maxDuration = 60`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: transcribe job with caption fallback and single analyze trigger`.

### Task 9: Analyze job

**Files:**
- Create: `lib/pipeline/analyze.ts`, `app/api/jobs/analyze/route.ts`, `tests/fixtures/gpt-patterns.json`, `tests/fixtures/gpt-compare.json`, `tests/pipeline.analyze.test.ts`

**Interfaces:**
- Consumes: `Deps.openai.json`, `Store`.
- Produces:
  - `PatternsOut = z.object({ patterns: z.array(z.object({ name: z.string(), competitorCount: z.number().int().min(0).max(10), postIds: z.array(z.string()) })).min(3).max(8) })`
  - `CompareOut = z.object({ clientCounts: z.array(z.object({ name: z.string(), clientCount: z.number().int().min(0).max(10) })), gaps: z.array(z.object({ text: z.string(), kind: z.enum(['gap','keep']) })).min(2).max(6), recommendations: z.array(z.object({ text: z.string(), reason: z.string(), postId: z.string() })).min(3).max(5), scripts: z.array(ScriptZ).length(3) })`, where `ScriptZ` matches `Script` from Task 3 and has `lengthS` between 15 and 60
  - `analyzeRun(deps: Deps, runId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests** (`openai.json` is faked to return the fixtures in call order):
```ts
it('saves analysis and marks the run done', async () => {
  // run.status 'done'; analysis.patterns[i].clientCount taken from clientCounts by name (0 when missing); scripts length 3
});
it('drops recommendations citing unknown or client posts', async () => {
  // gpt-compare.json has 4 recs: competitor id, 'nope', a client post id, competitor id → saved recommendations length 2
});
it('fails when no recommendation is valid', async () => {
  // → run { status:'failed', failedStep:'analyze', error:'The analysis came back incomplete. Retry the failed step.' }
});
it('retries a failed model call once, then fails the run', async () => {
  const json = vi.fn().mockRejectedValue(new Error('bad json'));
  // json called 2 times; run failed at analyze with the same error copy
});
it('does nothing unless the run is analyzing', async () => {
  // run 'done' → json not called
});
```
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `analyzeRun`.
  - Build each transcript block as `[post:<id>] @handle · <metric value> <views|likes> · <durationS>s\n<text>`.
  - **Call A** (system prompt): "You analyze short-form video transcripts. Find 3–8 patterns shared by the top-performing competitor reels: hook style in the first 2 seconds, topic, structure, length, call to action, tone. For each pattern give competitorCount: on average, how many of each competitor's top 10 reels show it (0–10). List the post ids that show it. Use only post ids from the input." The user message is the niche plus the competitor blocks.
  - **Call B** (system prompt): "Compare the client's reels with these competitor patterns. Score each pattern 0–10 for the client using the same names. List 2–6 differences, each marked gap (to fix) or keep (a strength). Write 3–5 short recommendations; each must cite the id of the one competitor reel that best shows it. Write 3 scripts in the client's own voice (match their wording and story style), 15–60 seconds, each with a hook, timed beats, a call to action and the pattern names it uses." The user message is the patterns JSON plus the client blocks plus the list of competitor post ids with their handles.
  - Each call gets 1 retry on any throw. Merge `clientCounts` into the patterns by name.
  - Keep only recommendations whose `postId` is a competitor post in this run; fail if none remain.
  - `saveAnalysis` → `transitionRun(runId,'analyzing',{status:'done'})` → emit `{step:'done', message:'3 scripts ready'}`.
  - A failure does `updateRun({status:'failed', failedStep:'analyze', error})` and emits `{step:'failed'}`.
- [ ] **Step 4:** Write the route: `checkSecret` (401), zod `{ runId: uuid }`, `await analyzeRun`, `maxDuration = 60`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: two-pass gpt analysis with citation checks`.

### Task 10: Read and retry APIs

**Files:**
- Create: `lib/pipeline/retry.ts`, `app/api/runs/[id]/route.ts`, `app/api/runs/[id]/retry/route.ts`, `tests/pipeline.retry.test.ts`
- Modify: `app/api/runs/route.ts` (add GET)

**Interfaces:**
- Produces:
  - `GET /api/runs` → `{ runs: { id; niche; clientHandle; competitorHandles; status; error; postCount; createdAt }[] }`
  - `GET /api/runs/[id]` → `{ run: Omit<Run,'apifyRunId'>; posts: (Post & { transcript: Transcript|null })[]; analysis: Analysis|null; events: {at:string;message:string}[] }`, or 404 `{ error:'Run not found.' }`
  - `retryRun(deps: Deps, runId: string): Promise<{ status: 202 } | { status: 404|409; error: string }>`
    - `fetch` → `apify.start` again, status `fetching`
    - `transcribe` → status `transcribing`, `remaining` set to the number of posts without a transcript, and jobs sent for those posts only
    - `analyze` → status `analyzing`, and the analyze job sent
    - The run's `error` and `failedStep` are cleared.
    - 409 `'Only failed runs can be retried.'` when the run isn't failed; 409 `'Another analysis is already running. Try again when it finishes.'` when another run is active.

- [ ] **Step 1: Write the failing tests** for `retryRun`:
  - One test per `failedStep`, checking the new status and the jobs in `d.sent`.
  - A transcribe retry with 19 posts and 15 transcripts sends exactly 4 jobs and sets `remaining` to 4.
  - Both 409 cases.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `retryRun` and the three routes. Response bodies are built field by field from the Interfaces block; nothing else is serialised.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: run read and retry apis`.

### Task 11: UI foundation (tokens, shell, modal)

**Files:**
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/_components/Shell.tsx`, `Icon.tsx`, `Modal.tsx`, `Toast.tsx`, `tests/ui/modal.test.tsx`

**Interfaces:**
- Produces:
  - `<Shell active: 'new'|'results'|'runs'; recent: { id; niche; clientHandle }[]>`: the sidebar from the prototype (New analysis, Latest results, Runs, recent runs, "Prototype · demo data" replaced by "Reel Intel"), becoming a top bar under 820px
  - `<Icon name: 'plus'|'list'|'chart'|'x'|'search'|'ext'|'copy'|'left'|'right'|'check'|'alert'|'mic'|'cap'|'retry'|'play'; size?: 15|18 />`: the prototype's SVG paths, `aria-hidden`
  - `<Modal labelledBy: string; onClose(); onPrev?(); onNext?(); children>`: a portal to `document.body`. It traps focus, closes on Esc and on a click on the backdrop, maps ←/→ to `onPrev`/`onNext`, locks body scroll, and gives focus back to the element that opened it.
  - `useToast(): (msg: string) => void`
  - `copyText(text: string, label: string, toast)`: on success the toast says `` `${label} copied` ``; on failure it says `'Copy is blocked here. Select the text and copy it instead.'`
  - `app/page.tsx`: a server component that redirects to `/runs/<newest done run>`, or to `/new` when there is none

- [ ] **Step 1: Write the failing tests** in `tests/ui/modal.test.tsx`:
  - Esc calls `onClose`.
  - Tab from the last focusable element moves to the first.
  - The button that opened the modal has focus again after it closes.
  - ArrowRight calls `onNext`.
  - A click on the backdrop calls `onClose`, but a click inside the dialog does not.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the files.
  - Copy the `:root`, dark-media and `[data-theme="dark"]` token blocks plus the base classes from `design/reel-intel-prototype.html` into `globals.css` unchanged.
  - Load Fira Sans 400/500/600 and Fira Code 400/500 with `next/font/google` in `layout.tsx`, exposed as the CSS variables `--f-sans` and `--f-mono`.
- [ ] **Step 4:** Run the tests and `npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: ui tokens, shell, modal`.

### Task 12: New analysis page

**Files:**
- Create: `app/new/page.tsx`, `app/new/_components/NewRunForm.tsx`, `HandleTags.tsx`, `tests/ui/new-run-form.test.tsx`

**Interfaces:**
- Consumes: `normaliseHandle`, `tagError`, `validateRunInput`, `POST /api/runs`, `GET /api/runs/[id]` (for prefill).
- Produces: `/new?from=<runId>`, which prefills niche, client and competitors from that run; this is what the results page's Re-run button uses.

- [ ] **Step 1: Write the failing tests**:
  - Typing `@Alpha,` adds the tag `@alpha`.
  - Pasting `a, b c` adds 3 tags.
  - Backspace in an empty input removes the last tag.
  - Typing the client's handle as a competitor shows `@me is already the client.` under the field.
  - Leaving the client field empty shows `Enter the client's Instagram handle.`.
  - Submitting with 1 competitor focuses the competitor input and shows `Add 2 more competitors. You need 3 to 10.`.
  - A 409 response shows its `error` text above the submit buttons.
  - A 201 response calls `router.push('/runs/<id>')`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the page as in the prototype's `newView()`:
  - niche buttons with `aria-pressed`
  - the client input, checked on blur
  - the tag input
  - the summary panel: accounts `x of 4–11`, window, top 10 videos each, ranked by views else likes, `~max(2, round(accounts × 0.9)) min`, and the video-only note
  - Clear and Run analysis buttons; Run analysis shows "Starting…" while the request is pending
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: new analysis page`.

### Task 13: Run progress and Runs list

**Files:**
- Create: `app/runs/page.tsx`, `app/runs/[id]/page.tsx`, `app/runs/[id]/_components/RunProgress.tsx`, `tests/ui/run-progress.test.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/runs`
  - `GET /api/runs/[id]`
  - `POST /api/runs/[id]/retry`
  - Realtime: the browser client (anon key) subscribes with `supabase.channel('run:'+id).on('broadcast',{event:'progress'},cb).subscribe()`
- Produces:
  - `<RunProgress run initialEvents onEvent?>`: takes its events as props and state, so tests don't need Supabase
  - `app/runs/[id]/page.tsx` renders `<RunProgress>` while the status is `fetching`, `transcribing` or `analyzing`, and `<Results>` (Task 14) when it's `done`. A failed run shows the error with a "Retry the failed step" button.

- [ ] **Step 1: Write the failing tests** for `RunProgress`:
  - The 5 steps render with the done, active and pending states, based on `run.status`.
  - A `{step:'transcribe', transcribed:12, total:40}` event shows `12/40`, and the progress bar has `aria-valuenow="12"`.
  - Each event message is added to the activity log.
  - A `done` event calls `router.refresh()`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement as in the prototype's `runView()` and `historyView()`.
  - Start from the stored events, add live broadcasts, and refetch the run every 15 s in case a broadcast is missed.
  - The Runs table rows link to `/runs/[id]`. Failed rows show the error and a "Retry the failed step" button that POSTs the retry and then goes to `/runs/[id]`; its 409 message appears inline.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: live run progress and runs list`.

### Task 14: Results page (overview, posts, scripts, pop-ups)

**Files:**
- Create: `lib/view.ts`, `app/runs/[id]/_components/Results.tsx`, `OverviewTab.tsx`, `PostsTab.tsx`, `ScriptsTab.tsx`, `PostModal.tsx`, `ScriptModal.tsx`, `tests/view.test.ts`, `tests/ui/posts-tab.test.tsx`

**Interfaces:**
- Consumes: the `GET /api/runs/[id]` shape from Task 10, plus `Modal`, `copyText` and `Icon`.
- Produces (`lib/view.ts`, all pure):
  - `metric(p: Post): number`, which is `views ?? likes`
  - `median(nums: number[]): number`: the mean of the two middle values when the count is even
  - `kpis(posts: Post[], analysis: Analysis): { compMedian; clientMedian; gapPct; compAvgLen; clientAvgLen; topPattern: Pattern }`
    - `gapPct` is `Math.round((clientMedian/compMedian - 1) * 100)`
    - `topPattern` is the pattern with the highest `competitorCount`. Its scores (×10 as %) fill the 4th summary tile, labelled with the pattern's name. This replaces the prototype's fixed "Bold claim in first 2s" label, because pattern names come from GPT.
  - `filterPosts(posts, { acct: 'all'|'comp'|string; q: string; sort: 'views'|'new'|'len' })`: the search is case-insensitive over transcript text and handle
  - `dataNotes(run: Run, posts: (Post & {transcript})[]): string[]`, with the wording:
    - `` `@${h}: ${n} post${s} had no view count, so ${n===1?'it was':'they were'} ranked by likes.` ``
    - `` `@${h}: ${n} post${s} had no speech, so the caption is used as the transcript.` ``
    - `` `@${h} was skipped: ${reason}.` ``

- [ ] **Step 1: Write the failing tests** in `tests/view.test.ts`:
  - `median([1,2,3,4])` is `2.5`.
  - `kpis` with a client median of 28 and a competitor median of 260 gives `gapPct` of `-89`.
  - `filterPosts` with `q:'PROMPT'` matches the text `prompt`.
  - `acct:'comp'` excludes client posts.
  - `sort:'len'` is descending by `durationS`.
  - `dataNotes` produces `'@futurestack: 1 post had no view count, so it was ranked by likes.'`
- [ ] **Step 2: Write the failing tests** in `tests/ui/posts-tab.test.tsx`:
  - Search filters only after 180 ms (fake timers).
  - Matches are wrapped in `<mark>`.
  - "Show 10 more" appears when there are more than 10 matches and adds 10 rows.
  - A search with no matches shows `No transcripts mention "zzz"` and a Clear search button.
  - Clicking a row opens `PostModal`, and Next moves within the filtered list.
  - Opened from a recommendation (`OverviewTab`), Next moves through that account's posts.
  - Open on Instagram is `<a target="_blank" rel="noopener noreferrer" href={post.igUrl}>`.
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement the components as in the prototype's `resultsView`, `overviewTab`, `postsTab`, `scriptsTab`, `openPost` and `openScript`.
  - Tabs follow the ARIA tablist pattern with ←/→, and the active tab lives in `?tab=`.
  - Post pop-up timestamps come from `segments`, formatted `m:ss`. Caption transcripts show plain text with a "Caption · no speech found" label.
  - The "Found in the last 90 days" line uses `run.videosFound`.
  - The script pop-up shows `lengthS` as `${n}s` and the beats' `at` labels.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with the message `feat: results page with overview, transcripts and scripts`.

### Task 15: Deploy and end-to-end check

**Files:**
- Create: `README.md` (setup: Supabase migration, env vars, Vercel deploy, optional Deployment Protection)

- [ ] **Step 1:** Run `npm run typecheck && npm test && npm run build && ! grep -rn "console.log" app lib`. Expected: all pass, and the grep prints nothing.
- [ ] **Step 2:** Apply `0001_init.sql` to the Supabase project. Set every env var in Vercel (with `NEXT_PUBLIC_APP_URL` set to the production URL) and deploy.
- [ ] **Step 3:** Run one real analysis with 4 public AI-niche accounts.
  - Expected: the progress steps move live, transcripts appear for every kept post, and the results show patterns, 3–5 recommendations whose links open real competitor posts, and 3 scripts.
  - Copy one real dataset item from the Apify console. If its field names differ from `tests/fixtures/apify-items.json`, update the schema and the fixture, then re-run `npm test`.
- [ ] **Step 4:** Start a second analysis while one is running. Expected: `Another analysis is already running. Try again when it finishes.`
- [ ] **Step 5:** Commit with the message `docs: setup and deploy readme`.
