import { describe, expect, it } from 'vitest';
import items from './fixtures/apify-items.json';
import { defaultWindow } from '@/lib/date-range';
import { rankItems } from '@/lib/rank';

const now = new Date('2026-11-25T00:00:00Z');
const r = rankItems(items, { client: 'me', competitors: ['alpha', 'beta', 'gamma', 'zeta'] }, defaultWindow(now));

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
      { handle: 'zeta', reason: 'No video posts in the selected dates' },
    ]));
  it('marks the client', () =>
    expect(r.posts.filter((p) => p.isClient).map((p) => p.handle)).toEqual(['me', 'me']));
  it('ignores unparseable items', () =>
    expect(rankItems([null, 5, { timestamp: 3 }], { client: 'me', competitors: [] }, defaultWindow(now)).posts).toEqual([]));
  it('says when Instagram blocked the request instead of "not found"', () => {
    const res = rankItems(
      [{ inputUrl: 'https://www.instagram.com/me/', error: 'login_required' }, { inputUrl: 'https://www.instagram.com/a/', error: 'fetch_failed' }],
      { client: 'me', competitors: ['a'] },
      defaultWindow(now),
    );
    expect(res.skipped).toEqual([
      { handle: 'me', reason: 'Instagram blocked the request. Sign in to Instaloader or try again later' },
      { handle: 'a', reason: 'Instagram blocked the request. Sign in to Instaloader or try again later' },
    ]);
  });
  it('keeps real-world items whose optional fields are null or have other type values', () => {
    const real = {
      inputUrl: 'https://www.instagram.com/me/',
      ownerUsername: 'me',
      type: 'Video',
      productType: null,
      url: 'https://www.instagram.com/p/abc/',
      timestamp: '2026-11-20T10:00:00.000Z',
      videoViewCount: 1200,
      videoPlayCount: null,
      likesCount: 80,
      commentsCount: null,
      videoDuration: 31.4,
      videoUrl: 'https://cdn.example/v.mp4',
      caption: null,
      error: null,
      errorDescription: null,
    };
    const clip = { ...real, url: 'https://www.instagram.com/reel/def/', type: 'Clip', productType: 'clips', videoViewCount: 900 };
    const res = rankItems([real, clip], { client: 'me', competitors: [] }, defaultWindow(now));
    expect(res.posts.map((p) => p.igUrl)).toEqual(['https://www.instagram.com/p/abc/', 'https://www.instagram.com/reel/def/']);
    expect(res.posts[0]).toMatchObject({ views: 1200, comments: 0, caption: '', durationS: 31 });
    expect(res.videosFound).toMatchObject({ me: 2 });
  });
});
