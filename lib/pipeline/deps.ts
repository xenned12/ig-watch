import 'server-only';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import OpenAI, { toFile } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import { serverEnv, type ServerEnv } from '@/lib/env';
import { callbackHeaders, sendJob } from '@/lib/jobs';
import { apifyScraper } from '@/lib/scrapers/apify';
import { instaloaderScraper } from '@/lib/scrapers/instaloader';
import type { Scraper } from '@/lib/scrapers/types';
import { supabaseProgress, type Progress } from '@/lib/progress';
import { supabaseStore } from '@/lib/store/supabase';
import type { Store } from '@/lib/store/types';

export interface Deps {
  store: Store;
  progress: Progress;
  sendJob: typeof sendJob;
  apify: Scraper;
  openai: {
    transcribe(
      file: Blob,
      name: string,
    ): Promise<{ text: string; segments: { start: number; text: string }[] }>;
    json<T>(schema: ZodType<T>, system: string, user: string): Promise<T>;
  };
  fetchVideo(url: string): Promise<Blob>;
  /** Background Instagram account search (profile details) for a keyword. */
  now(): Date;
}

export function makeDeps(): Deps {
  const env = serverEnv();
  const store = supabaseStore();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    store,
    progress: supabaseProgress(store),
    sendJob,
    // Post source, switched by SCRAPER. The field keeps its original name.
    apify: env.SCRAPER === 'instaloader' ? localInstaloader(env) : apifyScraper(env),
    openai: {
      async transcribe(file, name) {
        const res = await openai.audio.transcriptions.create({
          model: 'whisper-1',
          response_format: 'verbose_json',
          file: await toFile(file, name),
        });
        return {
          text: res.text,
          segments: (res.segments ?? []).map((s) => ({ start: s.start, text: s.text })),
        };
      },
      async json<T>(schema: ZodType<T>, system: string, user: string): Promise<T> {
        const completion = await openai.chat.completions.parse({
          model: env.OPENAI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: zodResponseFormat(schema, 'out'),
        });
        const parsed = completion.choices[0]?.message.parsed;
        if (parsed === null || parsed === undefined) throw new Error('OpenAI returned no parsed output');
        return parsed as T;
      },
    },
    async fetchVideo(url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`Video download failed: ${res.status}`);
      return res.blob();
    },
    now: () => new Date(),
  };
}

// Local-only Instaloader scraper: runs scripts/instaloader_scrape.py and reports
// back through the same webhook Apify uses.
// Paths are plain relative strings resolved against the project folder (cwd):
// path.join(process.cwd(), …) would make the bundler try to trace these files.
function localInstaloader(env: ServerEnv): Scraper {
  return instaloaderScraper({
    cwd: process.cwd(),
    python: env.INSTALOADER_PYTHON ?? '.venv/bin/python',
    script: 'scripts/instaloader_scrape.py',
    dir: join(tmpdir(), 'reel-intel-instaloader'),
    login: env.INSTALOADER_USERNAME,
    async notify(done) {
      const res = await fetch(env.NEXT_PUBLIC_APP_URL + '/api/webhooks/apify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...callbackHeaders(env) },
        body: JSON.stringify(done),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Webhook call failed: ${res.status}`);
    },
  });
}
