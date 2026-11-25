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
