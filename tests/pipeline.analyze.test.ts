import { OPENAI_OUT_OF_CREDITS } from '@/lib/pipeline/credits';
import { describe, expect, it, vi } from 'vitest';
import { analyzeRun } from '@/lib/pipeline/analyze';
import type { NewPost } from '@/lib/store/types';
import type { Deps } from '@/lib/pipeline/deps';
import patternsFixture from './fixtures/gpt-patterns.json';
import compareFixture from './fixtures/gpt-compare.json';
import { fakeDeps, type FakeDeps } from './fakes';

const FAIL_COPY = 'The analysis came back incomplete. Retry the failed step.';

const mkPost = (n: number, isClient: boolean): NewPost => ({
  handle: isClient ? 'me' : 'alpha',
  isClient,
  igUrl: 'https://ig/' + n,
  postedAt: '2026-11-01T00:00:00Z',
  views: 100,
  likes: 10,
  comments: 1,
  durationS: 20,
  rankMetric: 'views',
  rank: n,
  videoUrl: null,
  caption: 'caption ' + n,
});

function substitute<T>(value: T, ids: Record<string, string>): T {
  let s = JSON.stringify(value);
  for (const [k, v] of Object.entries(ids)) s = s.split('"' + k + '"').join('"' + v + '"');
  return JSON.parse(s) as T;
}

async function setup(status: 'analyzing' | 'done' = 'analyzing', json?: Deps['openai']['json']) {
  const base = fakeDeps();
  const run = await base.store.createRun({
    niche: 'AI',
    clientHandle: 'me',
    competitorHandles: ['alpha'],
  });
  const posts = await base.store.replacePosts(run.id, [mkPost(1, false), mkPost(2, false), mkPost(3, true)]);
  await base.store.updateRun(run.id, { status });
  await base.store.saveTranscriptOnce({
    postId: posts[0].id,
    text: 'spoken one',
    segments: [],
    source: 'whisper',
  });
  const ids = { COMP_1: posts[0].id, COMP_2: posts[1].id, CLIENT_1: posts[2].id };
  const patterns = substitute(patternsFixture, ids);
  const compare = substitute(compareFixture, ids);
  const fn =
    json ??
    (vi.fn().mockResolvedValueOnce(patterns).mockResolvedValueOnce(compare) as unknown as Deps['openai']['json']);
  const d: FakeDeps = Object.assign(base, { openai: { ...base.openai, json: fn } });
  return { d, runId: run.id, ids, fn };
}

describe('analyzeRun', () => {
  it('saves analysis and marks the run done', async () => {
    const { d, runId, ids } = await setup();
    await analyzeRun(d, runId);
    const run = await d.store.getRun(runId);
    const analysis = await d.store.getAnalysis(runId);
    expect(run?.status).toBe('done');
    expect(analysis?.scripts).toHaveLength(3);
    expect(analysis?.patterns.map((p) => p.clientCount)).toEqual([3, 1, 0]);
    expect(analysis?.patterns[1].postIds).toEqual([ids.COMP_2]);
    expect(d.events.at(-1)).toEqual({ step: 'done', message: '3 scripts ready' });
  });

  it('drops recommendations citing unknown or client posts', async () => {
    const { d, runId, ids } = await setup();
    await analyzeRun(d, runId);
    const analysis = await d.store.getAnalysis(runId);
    expect(analysis?.recommendations.map((r) => r.postId)).toEqual([ids.COMP_1, ids.COMP_2]);
  });

  it('fails when no recommendation is valid', async () => {
    const { d, runId, ids } = await setup('analyzing', undefined);
    const bad = substitute(compareFixture, ids);
    bad.recommendations = bad.recommendations.map((r) => ({ ...r, postId: 'nope' }));
    const json = vi
      .fn()
      .mockResolvedValueOnce(substitute(patternsFixture, ids))
      .mockResolvedValueOnce(bad);
    const d2: FakeDeps = Object.assign(d, { openai: { ...d.openai, json } });
    await analyzeRun(d2, runId);
    const run = await d2.store.getRun(runId);
    expect(run).toMatchObject({ status: 'failed', failedStep: 'analyze', error: FAIL_COPY });
    expect(await d2.store.getAnalysis(runId)).toBeNull();
  });

  it('retries a failed model call once, then fails the run', async () => {
    const json = vi.fn().mockRejectedValue(new Error('bad json'));
    const { d, runId } = await setup('analyzing', json as unknown as Deps['openai']['json']);
    await analyzeRun(d, runId);
    expect(json).toHaveBeenCalledTimes(2);
    const run = await d.store.getRun(runId);
    expect(run).toMatchObject({ status: 'failed', failedStep: 'analyze', error: FAIL_COPY });
    expect(d.events.at(-1)?.step).toBe('failed');
  });

  it('does nothing unless the run is analyzing', async () => {
    const { d, runId, fn } = await setup('done');
    await analyzeRun(d, runId);
    expect(fn).not.toHaveBeenCalled();
  });
  it('does not overwrite a run that moved on while the analysis was failing', async () => {
    const ctx: { d?: FakeDeps; id: string } = { id: '' };
    const json = (async () => {
      // Simulates the stale sweep + a retry moving the run on mid-analysis.
      if (ctx.d) await ctx.d.store.updateRun(ctx.id, { status: 'fetching' });
      throw new Error('openai down');
    }) as Deps['openai']['json'];
    const s = await setup('analyzing', json);
    ctx.d = s.d;
    ctx.id = s.runId;
    await analyzeRun(s.d, s.runId);
    expect(await s.d.store.getRun(s.runId)).toMatchObject({ status: 'fetching', failedStep: null });
    expect(s.d.events.some((e) => e.step === 'failed')).toBe(false);
  });
  it('says the OpenAI account is out of credits when it is', async () => {
    const json = (async () => {
      throw Object.assign(new Error('429 You have no credits remaining.'), { status: 429 });
    }) as Deps['openai']['json'];
    const { d, runId } = await setup('analyzing', json);
    await analyzeRun(d, runId);
    expect(await d.store.getRun(runId)).toMatchObject({
      status: 'failed',
      failedStep: 'analyze',
      error: OPENAI_OUT_OF_CREDITS,
    });
  });
});
