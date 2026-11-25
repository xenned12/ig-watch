import { describe, expect, it } from 'vitest';
import { dispatchTranscribeJobs } from '@/lib/pipeline/dispatch';
import { fakeDeps } from './fakes';

async function setup(sendJob: (path: string, body: object) => Promise<void>) {
  const d = fakeDeps({ sendJob: sendJob as never });
  const run = await d.store.createRun({ niche: 'AI', clientHandle: 'me', competitorHandles: ['a', 'b', 'c'] });
  const posts = await d.store.replacePosts(
    run.id,
    ['p1', 'p2', 'p3'].map((sc, i) => ({
      handle: 'a', shortcode: sc, url: `https://instagram.com/p/${sc}`, caption: `caption ${sc}`,
      views: 100 - i, likes: 1, comments: 1, postedAt: '2026-11-01T00:00:00Z', durationS: 10,
      videoUrl: null, thumbnailUrl: null, rank: i + 1,
    })) as never,
  );
  await d.store.updateRun(run.id, { status: 'transcribing', remaining: posts.length });
  return { d, runId: run.id, ids: posts.map((p) => p.id) };
}

describe('dispatchTranscribeJobs', () => {
  it('sends one job per post when every send works', async () => {
    const sent: object[] = [];
    const { d, runId, ids } = await setup(async (_p, body) => void sent.push(body));
    expect(await dispatchTranscribeJobs(d, runId, ids)).toEqual({ queued: 3, direct: 0 });
    expect(sent).toHaveLength(3);
  });

  it('resends a job that failed once', async () => {
    let calls = 0;
    const { d, runId, ids } = await setup(async () => {
      if (calls++ === 0) throw new Error('blip');
    });
    expect(await dispatchTranscribeJobs(d, runId, ids)).toEqual({ queued: 3, direct: 0 });
  });

  it('transcribes posts directly when their job never queues, so the run still finishes', async () => {
    const { d, runId, ids } = await setup(async (path, body) => {
      if (path === '/api/jobs/transcribe' && (body as { postId: string }).postId === ids[0]) throw new Error('down');
    });
    expect(await dispatchTranscribeJobs(d, runId, ids)).toEqual({ queued: 2, direct: 1 });
    expect((await d.store.listTranscripts(runId)).map((t) => t.postId)).toEqual([ids[0]]);
    expect((await d.store.getRun(runId))?.remaining).toBe(2);
    expect(d.events.some((e) => e.message === '1 transcription job could not be queued, so it is being transcribed directly.')).toBe(true);
  });
});
