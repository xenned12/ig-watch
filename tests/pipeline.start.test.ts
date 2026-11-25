import { describe, expect, it } from 'vitest';
import { retryRun } from '@/lib/pipeline/retry';
import { startRun } from '@/lib/pipeline/start';
import { fakeDeps } from './fakes';

const ok = { niche: 'AI', client: 'me', competitors: ['a', 'b', 'c'] };

describe('startRun', () => {
  it('creates a fetching run and stores the apify run id', async () => {
    const d = fakeDeps();
    const res = await startRun(d, ok, 'ip1');
    expect(res.status).toBe(201);
    expect(await d.store.getRun((res as { runId: string }).runId)).toMatchObject({
      status: 'fetching',
      apifyRunId: 'apify-1',
    });
    expect(d.events).toEqual([{ step: 'fetch', message: 'Run started for 4 accounts' }]);
  });

  it('409 while another run is active', async () => {
    const d = fakeDeps();
    await startRun(d, ok, 'ip1');
    expect(await startRun(d, ok, 'ip2')).toEqual({
      status: 409,
      error: 'Another analysis is already running. Try again when it finishes.',
    });
  });

  it('409 when createRun loses the race to another start', async () => {
    const d = fakeDeps();
    const real = d.store.activeRun.bind(d.store);
    d.store.activeRun = async () => null;
    await startRun(d, ok, 'ip1');
    expect((await startRun(d, ok, 'ip2')).status).toBe(409);
    d.store.activeRun = real;
  });

  it('429 on the 6th start in an hour from one ip', async () => {
    const d = fakeDeps();
    for (let i = 0; i < 5; i++) await d.store.recordStart('ip1');
    expect(await startRun(d, ok, 'ip1')).toEqual({
      status: 429,
      error: 'You have started 5 analyses in the last hour. Try again later.',
    });
  });

  it('400 with field errors', async () => {
    expect(await startRun(fakeDeps(), { niche: 'AI', client: 'me', competitors: ['a'] }, 'ip1')).toEqual({
      status: 400,
      errors: { competitors: 'Add 2 more competitors. You need 3 to 10.' },
    });
  });

  it('fails at fetch when apify start throws', async () => {
    const d = fakeDeps({
      apify: {
        async start() {
          throw new Error('apify down: secret detail');
        },
        async items() {
          return [];
        },
      },
    });
    const res = await startRun(d, ok, 'ip1');
    expect(res).toEqual({ status: 502, error: 'Could not start fetching posts. Try again.' });
    const run = await d.store.listRuns();
    expect(run[0]).toMatchObject({ status: 'failed', failedStep: 'fetch' });
    expect(d.events).toEqual([{ step: 'failed', message: 'Could not start fetching posts. Try again.' }]);
    expect(await d.store.activeRun()).toBeNull();
  });

  it('succeeds when the only active run is 31 minutes old', async () => {
    const d = fakeDeps();
    const old = await d.store.createRun({ niche: 'AI', clientHandle: 'x', competitorHandles: ['a', 'b', 'c'] });
    await d.store.updateRun(old.id, {
      startedAt: new Date(d.now().getTime() - 31 * 60_000).toISOString(),
    });
    expect((await startRun(d, ok, 'ip1')).status).toBe(201);
    expect(await d.store.getRun(old.id)).toMatchObject({ status: 'failed', failedStep: 'fetch' });
  });

  it('a run created 2 hours ago but retried now is not swept as stale', async () => {
    const d = fakeDeps();
    const run = await d.store.createRun({ niche: 'AI', clientHandle: 'x', competitorHandles: ['a', 'b', 'c'] });
    await d.store.updateRun(run.id, {
      status: 'failed',
      failedStep: 'analyze',
      createdAt: new Date(d.now().getTime() - 120 * 60_000).toISOString(),
      startedAt: new Date(d.now().getTime() - 120 * 60_000).toISOString(),
    });
    expect(await retryRun(d, run.id)).toEqual({ status: 202 });
    expect(await startRun(d, ok, 'ip1')).toEqual({
      status: 409,
      error: 'Another analysis is already running. Try again when it finishes.',
    });
    expect((await d.store.getRun(run.id))?.status).toBe('analyzing');
  });
});
