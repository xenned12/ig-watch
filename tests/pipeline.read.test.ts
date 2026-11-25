import { describe, expect, it } from 'vitest';
import { runDetail, runList } from '@/lib/pipeline/read';
import type { NewPost } from '@/lib/store/types';
import { fakeDeps } from './fakes';

const mkPost = (handle: string, rank: number): NewPost => ({
  handle,
  isClient: handle === 'me',
  igUrl: `https://ig/${handle}/${rank}`,
  postedAt: '2026-11-01T00:00:00Z',
  views: 100,
  likes: 10,
  comments: 1,
  durationS: 20,
  rankMetric: 'views',
  rank,
  videoUrl: null,
  caption: 'c',
});

describe('runDetail', () => {
  it('omits apifyRunId, attaches transcript or null, orders by handle then rank', async () => {
    const d = fakeDeps();
    const run = await d.store.createRun({
      niche: 'AI',
      clientHandle: 'me',
      competitorHandles: ['alpha', 'beta', 'delta'],
    });
    await d.store.updateRun(run.id, { apifyRunId: 'secret-apify' });
    const posts = await d.store.replacePosts(run.id, [
      mkPost('beta', 2),
      mkPost('alpha', 2),
      mkPost('alpha', 1),
      mkPost('me', 1),
    ]);
    const first = posts.find((p) => p.handle === 'alpha' && p.rank === 1);
    if (!first) throw new Error('missing');
    await d.store.saveTranscriptOnce({
      postId: first.id,
      text: 'hello',
      segments: [{ startS: 0, text: 'hello' }],
      source: 'whisper',
    });
    await d.store.addEvent(run.id, 'started');

    const detail = await runDetail(d.store, run.id);
    if (!detail) throw new Error('expected detail');
    expect('apifyRunId' in detail.run).toBe(false);
    expect(JSON.stringify(detail)).not.toContain('secret-apify');
    expect(detail.posts.map((p) => `${p.handle}${p.rank}`)).toEqual(['alpha1', 'alpha2', 'beta2', 'me1']);
    expect(detail.posts[0]?.transcript?.text).toBe('hello');
    expect(detail.posts[1]?.transcript).toBeNull();
    expect(detail.analysis).toBeNull();
    expect(detail.events.map((e) => e.message)).toEqual(['started']);
  });

  it('returns null for an unknown run', async () => {
    expect(await runDetail(fakeDeps().store, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('runList', () => {
  it('returns only the list fields, with postCount', async () => {
    const d = fakeDeps();
    const run = await d.store.createRun({
      niche: 'AI',
      clientHandle: 'me',
      competitorHandles: ['alpha', 'beta', 'delta'],
    });
    await d.store.updateRun(run.id, { apifyRunId: 'secret-apify' });
    await d.store.replacePosts(run.id, [mkPost('alpha', 1), mkPost('alpha', 2)]);
    const list = await runList(d.store);
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(
      ['clientHandle', 'competitorHandles', 'createdAt', 'error', 'id', 'niche', 'postCount', 'status'].sort(),
    );
    expect(list[0]?.postCount).toBe(2);
  });
});
