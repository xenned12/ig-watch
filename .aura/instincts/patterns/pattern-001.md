---
id: pattern-001
category: auth
language: unknown
score: 50
tags: [auth, cookie]
---

## 컨텍스트
파일: 2026-11-25-ig-competitor-analyzer-design.md (Write 완료)

## 핵심 코드
```unknown
# Instagram Competitor Analyzer — Design

Date: 2026-11-25
Status: Awaiting review

## Goal

A signed-in user enters 4–11 public Instagram accounts from one niche. One account is the client; the others are its competitors. The app:

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
| Auth, database, realtime, file storage | Supabase |
| Instagram data | Apify `apify/instagram-scraper` (free monthly credits) |
| Transcription | OpenAI Whisper (`whisper-1`) |
| Analysis + scripts | OpenAI GPT, structured JSON output (model set by env var) |
| Validation | Zod on every request body, webhook payload and LLM response |

Secrets live only in Vercel environment variables, never in the browser or the repo: `APIFY_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`. A committed `.env.example` lists them, and `.env*` is in `.gitignore`.

## Screens

The approved mockup has these screens:

1. **Login.** Supabase email magic link. The session is kept in httpOnly cookies via `@supabase/ssr`; tokens are never stored in localStorage.
2. **New analysis.** Fields:
   - niche
   - client handle
   - 3–10 competitor handles (4–11 accounts in total)
   - "Run analysis" button
3. **Run results.** This page:
   - shows a live progress strip (Fetch → Rank → Transcribe → Analyze → Scripts)
   - shows summary numbers
   - lists the shared competitor patterns, each with how many top posts show it
   - lists the client's gaps, plus the strengths to keep
   - shows 3 script cards (hook / body / CTA, with a copy button)
   - lists the top posts per account, with transcripts and links to Instagram
4. **History.** A list of the user's past runs.

## Pipeline
```

## 태그
- auth
- cookie