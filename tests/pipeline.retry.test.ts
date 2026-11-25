import { describe, expect, it } from 'vitest';
import { retryRun } from '@/lib/pipeline/retry';
import type { NewPost } from '@/lib/store/types';
import type { Step } from '@/lib/types';
import { fakeDeps, type FakeDeps } from './fakes';

const mkPost = (n: number): NewPost => ({
  handle: 'alpha',
  isClient: false,
  igUrl: 'https://ig/' + n,
  postedAt: '2026-11-01T00:00:00Z',
  views: 100,
  likes: 10,
  comments: 1,
  durationS: 20,
  rankMetric: 'views',
  rank: n,
  videoUrl: 'https://v/' + n,
  caption: 'caption ' + n,
});

async function failedRun(step: Step | null, postCount = 0, transcribed = 0, d: FakeDeps = fakeDeps()) {
  const run = await d.store.createRun({
    niche: 'AI',
    clientHandle: 'me',
    competitorHandles: ['alpha', 'beta', 'delta'],
  });
  const posts = await d.store.replacePosts(
    run.id,
    Array.from({ length: postCount }, (_, i) => mkPost(i + 1)),
  );
  for (const p of posts.slice(0, transcribed)) {
    await d.store.saveTranscriptOnce({ postId: p.id, text: 't', segments: [], source: 'whisper' });
  }
  await d.store.updateRun(run.id, { status: 'failed', failedStep: step, error: 'boom' });
  return { d, runId: run.id, posts };
}

describe('retryRun', () => {
  it('fetch: restarts apify with client first, status fetching, clears error', async () => {
    const calls: string[][] = [];
    const d = fakeDeps({
      apify: {
        async start(handles) {
          calls.push(handles);
          return 'apify-2';
        },
        async items() {
          return [];
        },
      },
    });
    const { runId } = await failedRun('fetch', 0, 0, d);
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(calls).toEqual([['me', 'alpha', 'beta', 'delta']]);
    expect(await d.store.getRun(runId)).toMatchObject({
      status: 'fetching',
      failedStep: null,
      error: null,
      apifyRunId: 'apify-2',
    });
    expect(d.events).toContainEqual({ step: 'fetch', message: 'Retrying: fetching posts' });
  });

  it('transcribe: 19 posts and 15 transcripts sends exactly 4 jobs and sets remaining 4', async () => {
    const { d, runId, posts } = await failedRun('transcribe', 19, 15);
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(await d.store.getRun(runId)).toMatchObject({
      status: 'transcribing',
      remaining: 4,
      failedStep: null,
      error: null,
    });
    expect(d.sent).toHaveLength(4);
    const ids = new Set(posts.slice(15).map((p) => p.id));
    for (const j of d.sent) {
      expect(j.path).toBe('/api/jobs/transcribe');
      expect(ids.has((j.body as { postId: string }).postId)).toBe(true);
    }
    expect(d.events).toContainEqual({
      step: 'transcribe',
      message: 'Retrying: transcribing 4 posts',
    });
  });

  it('transcribe with nothing left goes straight to analyzing', async () => {
    const { d, runId } = await failedRun('transcribe', 3, 3);
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(await d.store.getRun(runId)).toMatchObject({ status: 'analyzing', remaining: 0 });
    expect(d.sent).toEqual([{ path: '/api/jobs/analyze', body: { runId } }]);
  });

  it('analyze: status analyzing and analyze job sent', async () => {
    const { d, runId } = await failedRun('analyze', 3, 3);
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(await d.store.getRun(runId)).toMatchObject({
      status: 'analyzing',
      failedStep: null,
      error: null,
    });
    expect(d.sent).toEqual([{ path: '/api/jobs/analyze', body: { runId } }]);
    expect(d.events).toContainEqual({ step: 'analyze', message: 'Retrying: comparing transcripts' });
  });

  it('404 for unknown run', async () => {
    const d = fakeDeps();
    expect(await retryRun(d, '00000000-0000-4000-8000-000000000000')).toEqual({
      status: 404,
      error: 'Run not found.',
    });
  });

  it('409 when the run is not failed', async () => {
    const { d, runId } = await failedRun('fetch');
    await d.store.updateRun(runId, { status: 'done' });
    expect(await retryRun(d, runId)).toEqual({
      status: 409,
      error: 'Only failed runs can be retried.',
    });
  });

  it('409 when another run is active', async () => {
    const { d, runId } = await failedRun('analyze', 1, 1);
    await d.store.createRun({ niche: 'AI', clientHandle: 'x', competitorHandles: ['a', 'b', 'c'] });
    expect(await retryRun(d, runId)).toEqual({
      status: 409,
      error: 'Another analysis is already running. Try again when it finishes.',
    });
    expect(d.sent).toHaveLength(0);
  });

  it('only one of two concurrent retries proceeds', async () => {
    const { d, runId } = await failedRun('analyze', 1, 1);
    const [a, b] = await Promise.all([retryRun(d, runId), retryRun(d, runId)]);
    expect([a.status, b.status].sort()).toEqual([202, 409]);
    expect(d.sent).toHaveLength(1);
  });

  it('fetch retry when apify.start throws: back to failed, 502', async () => {
    const d = fakeDeps({
      apify: {
        async start() {
          throw new Error('nope');
        },
        async items() {
          return [];
        },
      },
    });
    const { runId } = await failedRun('fetch', 0, 0, d);
    const msg = 'Could not start fetching posts. Try again.';
    expect(await retryRun(d, runId)).toEqual({ status: 502, error: msg });
    expect(await d.store.getRun(runId)).toMatchObject({
      status: 'failed',
      failedStep: 'fetch',
      error: msg,
    });
  });

  it('failedStep null is treated as a fetch retry', async () => {
    const { d, runId } = await failedRun(null);
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(await d.store.getRun(runId)).toMatchObject({ status: 'fetching', apifyRunId: 'apify-1' });
  });

  it('analyze retry: sendJob throwing marks the run failed again, 502', async () => {
    const d = fakeDeps({
      async sendJob() {
        throw new Error('down');
      },
    });
    const { runId } = await failedRun('analyze', 1, 1, d);
    const msg = 'Could not start the analysis. Retry the failed step.';
    expect(await retryRun(d, runId)).toEqual({ status: 502, error: msg });
    expect(await d.store.getRun(runId)).toMatchObject({ status: 'failed', failedStep: 'analyze', error: msg });
    expect(d.events).toContainEqual({ step: 'failed', message: msg });
  });

  it('transcribe retry: every job rejecting marks the run failed again, 502', async () => {
    const d = fakeDeps({
      async sendJob() {
        throw new Error('down');
      },
    });
    const { runId } = await failedRun('transcribe', 3, 0, d);
    const msg = 'Could not start transcription. Retry the failed step.';
    expect(await retryRun(d, runId)).toEqual({ status: 502, error: msg });
    expect(await d.store.getRun(runId)).toMatchObject({ status: 'failed', failedStep: 'transcribe', error: msg });
  });

  it('transcribe retry: partial rejection keeps 202 and emits the partial event', async () => {
    let n = 0;
    const d = fakeDeps({
      async sendJob() {
        n += 1;
        if (n === 1) throw new Error('down');
      },
    });
    const { runId } = await failedRun('transcribe', 3, 0, d);
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(d.events.some((e) => e.message.startsWith('Some transcription jobs could not be started.'))).toBe(true);
  });

  it('retries a run stuck in analyzing for 31 minutes', async () => {
    const { d, runId } = await failedRun('analyze', 1, 1);
    await d.store.updateRun(runId, {
      status: 'analyzing',
      createdAt: new Date(d.now().getTime() - 31 * 60_000).toISOString(),
    });
    expect(await retryRun(d, runId)).toEqual({ status: 202 });
    expect(await d.store.getRun(runId)).toMatchObject({ status: 'analyzing', failedStep: null });
    expect(d.sent).toHaveLength(1);
  });
});
