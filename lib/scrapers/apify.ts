import 'server-only';
import { ApifyClient } from 'apify-client';
import type { ServerEnv } from '@/lib/env';
import { callbackHeaders } from '@/lib/jobs';
import type { Scraper } from './types';

const FINISHED: Record<string, string> = {
  SUCCEEDED: 'ACTOR.RUN.SUCCEEDED',
  FAILED: 'ACTOR.RUN.FAILED',
  'TIMED-OUT': 'ACTOR.RUN.TIMED_OUT',
  ABORTED: 'ACTOR.RUN.ABORTED',
};

// Apify's hosted instagram-scraper; Apify calls our webhook when the run ends.
export function apifyScraper(env: ServerEnv): Scraper {
  const client = new ApifyClient({ token: env.APIFY_TOKEN });
  return {
    async start(handles, runId, window) {
      const run = await client.actor('apify/instagram-scraper').start(
        {
          directUrls: handles.map((h) => 'https://www.instagram.com/' + h + '/'),
          resultsType: 'posts',
          resultsLimit: 60,
          // Apify takes the oldest date; posts after `until` are dropped when ranking.
          onlyPostsNewerThan: window.since.slice(0, 10),
        },
        {
          webhooks: [
            {
              eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
              requestUrl: env.NEXT_PUBLIC_APP_URL + '/api/webhooks/apify',
              payloadTemplate: '{"runId":"' + runId + '","eventType":{{eventType}},"apifyRunId":{{resource.id}}}',
              headersTemplate: JSON.stringify(callbackHeaders(env)),
            },
          ],
        },
      );
      return run.id;
    },
    async items(apifyRunId) {
      const { items } = await client.run(apifyRunId).dataset().listItems();
      return items;
    },
    async status(apifyRunId) {
      const run = await client.run(apifyRunId).get();
      if (!run) return { event: null, message: null };
      const message = run.statusMessage ?? null;
      if (run.status === 'READY' || run.status === 'RUNNING') return { event: null, message };
      return { event: FINISHED[run.status] ?? 'ACTOR.RUN.FAILED', message };
    },
  };
}

const TRANSCRIPT_ACTOR = 'iddqd/instagram-reel-transcript';
// Leaves headroom under the transcribe job's 300 s limit.
const TRANSCRIPT_WAIT_SECS = 240;

type TranscriptItem = {
  status?: string;
  text?: string;
  segments?: { start: number; text: string }[];
  error?: { code?: string; message?: string };
};

/** Transcribes one public reel with Apify's reel-transcript actor and waits for it. */
export async function apifyReelTranscript(
  env: ServerEnv,
  reelUrl: string,
): Promise<{ text: string; segments: { start: number; text: string }[] }> {
  const client = new ApifyClient({ token: env.APIFY_TOKEN });
  const run = await client
    .actor(TRANSCRIPT_ACTOR)
    .call({ startUrls: [{ url: reelUrl }], maxItems: 1, outputFormats: ['text'] }, { waitSecs: TRANSCRIPT_WAIT_SECS });
  if (run.status !== 'SUCCEEDED') throw new Error(`Transcript run ended as ${run.status}`);

  const { items } = await client.dataset<TranscriptItem>(run.defaultDatasetId).listItems();
  const item = items.find((i) => i.status === 'ok');
  if (!item) {
    const err = items[0]?.error;
    throw new Error(`No transcript: ${err?.code ?? 'empty'} ${err?.message ?? ''}`.trim());
  }
  const segments = (item.segments ?? []).map((s) => ({ start: s.start, text: s.text.trim() }));
  return { text: item.text ?? segments.map((s) => s.text).join(' '), segments };
}
