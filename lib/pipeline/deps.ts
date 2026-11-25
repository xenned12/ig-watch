import 'server-only';
import { ApifyClient } from 'apify-client';
import OpenAI, { toFile } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import { serverEnv } from '@/lib/env';
import { callbackHeaders, sendJob } from '@/lib/jobs';
import { supabaseProgress, type Progress } from '@/lib/progress';
import { supabaseStore } from '@/lib/store/supabase';
import type { Store } from '@/lib/store/types';

export interface Deps {
  store: Store;
  progress: Progress;
  sendJob: typeof sendJob;
  apify: {
    start(handles: string[], runId: string): Promise<string>;
    items(apifyRunId: string): Promise<unknown[]>;
  };
  openai: {
    transcribe(
      file: Blob,
      name: string,
    ): Promise<{ text: string; segments: { start: number; text: string }[] }>;
    json<T>(schema: ZodType<T>, system: string, user: string): Promise<T>;
  };
  fetchVideo(url: string): Promise<Blob>;
  now(): Date;
}

export function makeDeps(): Deps {
  const env = serverEnv();
  const store = supabaseStore();
  const apifyClient = new ApifyClient({ token: env.APIFY_TOKEN });
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    store,
    progress: supabaseProgress(store),
    sendJob,
    apify: {
      async start(handles, runId) {
        const run = await apifyClient.actor('apify/instagram-scraper').start(
          {
            directUrls: handles.map((h) => 'https://www.instagram.com/' + h + '/'),
            resultsType: 'posts',
            resultsLimit: 60,
            onlyPostsNewerThan: '90 days',
          },
          {
            webhooks: [
              {
                eventTypes: [
                  'ACTOR.RUN.SUCCEEDED',
                  'ACTOR.RUN.FAILED',
                  'ACTOR.RUN.TIMED_OUT',
                  'ACTOR.RUN.ABORTED',
                ],
                requestUrl: env.NEXT_PUBLIC_APP_URL + '/api/webhooks/apify',
                payloadTemplate:
                  '{"runId":"' + runId + '","eventType":{{eventType}},"apifyRunId":{{resource.id}}}',
                headersTemplate: JSON.stringify(callbackHeaders(env)),
              },
            ],
          },
        );
        return run.id;
      },
      async items(apifyRunId) {
        const { items } = await apifyClient.run(apifyRunId).dataset().listItems();
        return items;
      },
    },
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
