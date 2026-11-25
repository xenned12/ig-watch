import { describe, it, expect } from 'vitest';
import { dataNotes, filterPosts, kpis, median, type PostWithTranscript } from '@/lib/view';
import type { Analysis, Post, Run } from '@/lib/types';

function post(id: string, handle: string, over: Partial<Post> = {}, text = 'hello'): PostWithTranscript {
  return {
    id,
    runId: 'r1',
    handle,
    isClient: handle === 'client',
    igUrl: `https://www.instagram.com/reel/${id}/`,
    postedAt: '2026-10-01T00:00:00Z',
    views: 100,
    likes: 10,
    comments: 1,
    durationS: 30,
    rankMetric: 'views',
    rank: 1,
    videoUrl: null,
    caption: 'cap',
    transcript: { postId: id, text, segments: [{ startS: 0, text }], source: 'whisper' },
    ...over,
  };
}

const analysis = (patterns: Analysis['patterns']): Analysis => ({
  runId: 'r1',
  patterns,
  gaps: [],
  recommendations: [],
  scripts: [],
});

describe('median', () => {
  it('averages the two middle values when the count is even', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBe(0);
  });
});

describe('kpis', () => {
  it('computes the gap, lengths and top pattern', () => {
    const posts = [
      post('a', 'alpha', { views: 260, durationS: 40 }),
      post('b', 'client', { views: 28, durationS: 20 }),
    ];
    const k = kpis(
      posts,
      analysis([
        { name: 'Low', competitorCount: 2, clientCount: 1, postIds: [] },
        { name: 'High', competitorCount: 9, clientCount: 1, postIds: [] },
      ]),
    );
    expect(k.compMedian).toBe(260);
    expect(k.clientMedian).toBe(28);
    expect(k.gapPct).toBe(-89);
    expect(k.compAvgLen).toBe(40);
    expect(k.clientAvgLen).toBe(20);
    expect(k.topPattern?.name).toBe('High');
  });

  it('falls back to likes when views are missing', () => {
    const k = kpis([post('a', 'alpha', { views: null, likes: 50 }), post('b', 'client', { views: null, likes: 5 })], analysis([]));
    expect(k.compMedian).toBe(50);
    expect(k.topPattern).toBeNull();
  });
});

describe('filterPosts', () => {
  const posts = [
    post('a', 'alpha', { views: 10, durationS: 50, postedAt: '2026-09-01T00:00:00Z' }, 'A good prompt here'),
    post('b', 'client', { views: 30, durationS: 20, postedAt: '2026-11-01T00:00:00Z' }, 'Nothing'),
    post('c', 'beta', { views: 20, durationS: 35, postedAt: '2026-10-01T00:00:00Z' }, 'Other'),
  ];
  const base = { acct: 'all', q: '', sort: 'views' } as const;

  it('matches transcript text case-insensitively', () => {
    expect(filterPosts(posts, { ...base, q: 'PROMPT' }).map((p) => p.id)).toEqual(['a']);
  });
  it('matches the handle', () => {
    expect(filterPosts(posts, { ...base, q: 'bet' }).map((p) => p.id)).toEqual(['c']);
  });
  it('excludes client posts for comp', () => {
    expect(filterPosts(posts, { ...base, acct: 'comp' }).map((p) => p.id)).toEqual(['c', 'a']);
  });
  it('filters by a single handle', () => {
    expect(filterPosts(posts, { ...base, acct: 'client' }).map((p) => p.id)).toEqual(['b']);
  });
  it('sorts by length descending', () => {
    expect(filterPosts(posts, { ...base, sort: 'len' }).map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });
  it('sorts newest first', () => {
    expect(filterPosts(posts, { ...base, sort: 'new' }).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('dataNotes', () => {
  const run: Pick<Run, 'clientHandle' | 'competitorHandles' | 'skipped'> = {
    clientHandle: 'client',
    competitorHandles: ['futurestack', 'aitoolsdaily'],
    skipped: [{ handle: 'ghost', reason: 'the account is private' }],
  };
  it('describes missing views, caption transcripts and skipped accounts', () => {
    const posts = [
      post('a', 'futurestack', { views: null }),
      post('b', 'aitoolsdaily', {}, 'x'),
      { ...post('c', 'aitoolsdaily'), transcript: { postId: 'c', text: 'cap', segments: [], source: 'caption' as const } },
      { ...post('d', 'aitoolsdaily'), transcript: { postId: 'd', text: 'cap', segments: [], source: 'caption' as const } },
    ];
    expect(dataNotes(run, posts)).toEqual([
      '@futurestack: 1 post had no view count, so it was ranked by likes.',
      '@aitoolsdaily: 2 posts had no speech, so the caption is used as the transcript.',
      '@ghost was skipped: the account is private.',
    ]);
  });
  it('uses "they were" for several posts', () => {
    const posts = [post('a', 'client', { views: null }), post('b', 'client', { views: null })];
    expect(dataNotes({ ...run, skipped: [] }, posts)[0]).toBe(
      '@client: 2 posts had no view count, so they were ranked by likes.',
    );
  });
});
