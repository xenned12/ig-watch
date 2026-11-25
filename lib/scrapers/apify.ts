import 'server-only';
import { ApifyClient } from 'apify-client';
import type { ServerEnv } from '@/lib/env';
import { callbackHeaders } from '@/lib/jobs';
import type { Scraper } from './types';

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
  };
}
