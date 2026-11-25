import 'server-only';
import { ApifyClient } from 'apify-client';
import type { ServerEnv } from '@/lib/env';
import { callbackHeaders } from '@/lib/jobs';
import type { AccountSearch } from '@/lib/pipeline/deps';
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
    async start(handles, runId) {
      const run = await client.actor('apify/instagram-scraper').start(
        {
          directUrls: handles.map((h) => 'https://www.instagram.com/' + h + '/'),
          resultsType: 'posts',
          resultsLimit: 60,
          onlyPostsNewerThan: '90 days',
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

// Background Instagram account search with profile details (followers), used for
// the "top accounts" suggestions. start() returns the Apify run id; result() checks it.
export function apifyAccountSearch(env: ServerEnv): AccountSearch {
  const client = () => {
    if (!env.APIFY_TOKEN) throw new Error('Account search needs APIFY_TOKEN');
    return new ApifyClient({ token: env.APIFY_TOKEN });
  };
  return {
    async start(keyword) {
      const run = await client()
        .actor('apify/instagram-scraper')
        .start({ search: keyword, searchType: 'user', searchLimit: 20, resultsType: 'details', resultsLimit: 20 });
      return run.id;
    },
    async result(searchId) {
      const c = client();
      const run = await c.run(searchId).get();
      if (!run) return { state: 'failed' };
      if (run.status === 'READY' || run.status === 'RUNNING') return { state: 'running' };
      if (run.status !== 'SUCCEEDED') return { state: 'failed' };
      const { items } = await c.dataset(run.defaultDatasetId).listItems();
      return { state: 'done', items };
    },
  };
}
