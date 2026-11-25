import { describe, expect, it } from 'vitest';
import items from './fixtures/apify-items.json';
import { rankItems } from '@/lib/rank';

const now = new Date('2026-11-25T00:00:00Z');
const r = rankItems(items, { client: 'me', competitors: ['alpha', 'beta', 'gamma', 'zeta'] }, now);

describe('rankItems', () => {
  it('keeps top 10 videos in window, by views', () => {
    const a = r.posts.filter((p) => p.handle === 'alpha');
    expect(a.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(a[0].views! >= a[9].views!).toBe(true);
  });
  it('counts videos found in the window', () =>
    expect(r.videosFound).toMatchObject({ alpha: 12, beta: 4, me: 2 }));
  it('ranks a likes-only post by its likes', () => {
    const b = r.posts.filter((p) => p.handle === 'beta');
    expect(b[0]).toMatchObject({ views: null, rankMetric: 'likes', rank: 1 });
  });
  it('records skipped accounts with a reason', () =>
    expect(r.skipped).toEqual([
      { handle: 'gamma', reason: 'Account not found or private' },
      { handle: 'zeta', reason: 'No video posts in the last 90 days' },
    ]));
  it('marks the client', () =>
    expect(r.posts.filter((p) => p.isClient).map((p) => p.handle)).toEqual(['me', 'me']));
  it('ignores unparseable items', () =>
    expect(rankItems([null, 5, { timestamp: 3 }], { client: 'me', competitors: [] }, now).posts).toEqual([]));
});
