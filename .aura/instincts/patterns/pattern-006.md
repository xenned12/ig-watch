---
id: pattern-006
category: auth
language: unknown
score: 50
tags: [auth, zod]
---

## 컨텍스트
파일: 2026-11-25-reel-intel.md (Write 완료)

## 핵심 코드
```unknown
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
```

## 태그
- auth
- zod