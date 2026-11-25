import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pollScrape } from '@/lib/pipeline/webhook';
import type { Scraper } from '@/lib/scrapers/types';
import { fakeDeps } from './fakes';

const items: unknown[] = JSON.parse(
  readFileSync(new URL('./fixtures/apify-items.json', import.meta.url), 'utf8'),
);

async function setup(state: string | null, withStatus = true) {
  const apify: Scraper = {
    async start() {
      return 'apify-1';
    },
    async items() {
      return items;
    },
    ...(withStatus ? { status: async () => ({ event: state, message: state ? null : 'Crawled 147/191 pages, 0 failed requests.' }) } : {}),
  };
  const d = fakeDeps({ apify });
  const run = await d.store.createRun({
    niche: 'AI',
    clientHandle: 'me',
    competitorHandles: ['alpha', 'beta', 'delta'],
  });
  await d.store.updateRun(run.id, { apifyRunId: 'apify-1' });
  return { d, runId: run.id };
}

describe('pollScrape', () => {
  it('finishes the fetch step when the scrape has succeeded (no webhook needed)', async () => {
    const { d, runId } = await setup('ACTOR.RUN.SUCCEEDED');
    await pollScrape(d, runId);
    expect((await d.store.getRun(runId))?.status).toBe('transcribing');
    expect(await d.store.listPosts(runId)).toHaveLength(19);
  });

  it('marks the run failed when the scrape failed', async () => {
    const { d, runId } = await setup('ACTOR.RUN.FAILED');
    await pollScrape(d, runId);
    expect(await d.store.getRun(runId)).toMatchObject({ status: 'failed', failedStep: 'fetch' });
  });

  it('returns the live scraper message while the scrape is still running', async () => {
    const { d, runId } = await setup(null);
    expect(await pollScrape(d, runId)).toBe('Crawled 147/191 pages, 0 failed requests.');
    expect((await d.store.getRun(runId))?.status).toBe('fetching');
  });

  it('does nothing when the scraper cannot report status', async () => {
    const { d, runId } = await setup('ACTOR.RUN.SUCCEEDED', false);
    await pollScrape(d, runId);
    expect((await d.store.getRun(runId))?.status).toBe('fetching');
  });

  it('does not process twice when two polls arrive together', async () => {
    const { d, runId } = await setup('ACTOR.RUN.SUCCEEDED');
    await Promise.all([pollScrape(d, runId), pollScrape(d, runId)]);
    expect(d.sent).toHaveLength(19);
  });
});
