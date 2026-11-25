import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { PostsTab } from '@/app/runs/[id]/_components/PostsTab';
import { OverviewTab } from '@/app/runs/[id]/_components/OverviewTab';
import type { PostWithTranscript } from '@/lib/view';
import type { Analysis, Post } from '@/lib/types';

const run = {
  id: 'r1',
  niche: 'AI' as const,
  clientHandle: 'client',
  competitorHandles: ['alpha', 'beta'],
  status: 'done' as const,
  failedStep: null,
  error: null,
  skipped: [],
  videosFound: { alpha: 40, beta: 22, client: 9 },
  remaining: 0,
  createdAt: '2026-11-25T00:00:00Z', rangeSince: null, rangeUntil: null,
};

function mk(id: string, handle: string, over: Partial<Post> = {}, text = `reel ${id} about editing`): PostWithTranscript {
  return {
    id,
    runId: 'r1',
    handle,
    isClient: handle === 'client',
    igUrl: `https://www.instagram.com/reel/${id}/`,
    postedAt: '2026-10-01T00:00:00Z',
    views: 1000,
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

// 25 alpha posts, descending views so the list order is p1..p25.
const many: PostWithTranscript[] = Array.from({ length: 25 }, (_, i) =>
  mk(`p${i + 1}`, 'alpha', { views: 10000 - i }, i === 3 ? 'a great PROMPT trick' : `reel ${i + 1} about editing`),
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rows = (c: HTMLElement) => c.querySelectorAll('.prow');

describe('PostsTab', () => {
  it('filters only after 180 ms and wraps matches in <mark>', () => {
    const { container } = render(<PostsTab run={run} posts={many} />);
    expect(rows(container)).toHaveLength(10);
    fireEvent.change(screen.getByLabelText('Search transcripts'), { target: { value: 'prompt' } });
    act(() => void vi.advanceTimersByTime(179));
    expect(rows(container)).toHaveLength(10);
    act(() => void vi.advanceTimersByTime(1));
    expect(rows(container)).toHaveLength(1);
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('PROMPT');
  });

  it('shows 10 more rows at a time', () => {
    const { container } = render(<PostsTab run={run} posts={many} />);
    fireEvent.click(screen.getByRole('button', { name: /Show 10 more/ }));
    expect(rows(container)).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: /Show 10 more/ }));
    expect(rows(container)).toHaveLength(25);
    expect(screen.queryByRole('button', { name: /Show 10 more/ })).toBeNull();
  });

  it('shows an empty state with Clear search', () => {
    const { container } = render(<PostsTab run={run} posts={many} />);
    fireEvent.change(screen.getByLabelText('Search transcripts'), { target: { value: 'zzz' } });
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.getByText('No transcripts mention "zzz"')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(rows(container)).toHaveLength(10);
  });

  it('explains an account filter with no posts instead of an empty search', () => {
    render(<PostsTab run={run} posts={many} />);
    fireEvent.click(screen.getByRole('button', { name: /^@beta/ }));
    expect(screen.getByText('No video posts for this account in the last 90 days.')).toBeTruthy();
    expect(screen.queryByText(/No transcripts mention/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('opens a post and moves Next within the filtered list', () => {
    render(<PostsTab run={run} posts={many} />);
    fireEvent.click(document.querySelectorAll('.prow')[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Post 1 of 25/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next post' }));
    expect(within(screen.getByRole('dialog')).getByText(/Post 2 of 25/)).toBeTruthy();
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: /Open on Instagram/ });
    expect(link.getAttribute('href')).toBe('https://www.instagram.com/reel/p2/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('limits Next to the filter in use', () => {
    const mixed = [mk('a1', 'alpha', { views: 50 }), mk('b1', 'beta', { views: 40 }), mk('a2', 'alpha', { views: 30 })];
    render(<PostsTab run={run} posts={mixed} />);
    fireEvent.click(screen.getByRole('button', { name: /^@alpha/ }));
    fireEvent.click(document.querySelectorAll('.prow')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next post' }));
    expect(within(screen.getByRole('dialog')).getByText(/Post 2 of 2/)).toBeTruthy();
  });
});

describe('OverviewTab', () => {
  const posts = [
    mk('a1', 'alpha', { views: 500 }),
    mk('a2', 'alpha', { views: 900 }),
    mk('a3', 'alpha', { views: 100 }),
    mk('b1', 'beta', { views: 5000 }),
    mk('c1', 'client', { views: 40 }),
  ];
  const analysis: Analysis = {
    runId: 'r1',
    patterns: [{ name: 'Bold claim', competitorCount: 8, clientCount: 1, postIds: ['a1'] }],
    gaps: [{ text: 'You post shorter reels', kind: 'gap' }],
    recommendations: [
      { text: 'Open with a claim', reason: 'It wins', postId: 'a1' },
      { text: 'Ghost', reason: 'missing post', postId: 'nope' },
    ],
    scripts: [],
  };

  it('opens a recommendation source and moves Next through that account by metric', () => {
    render(<OverviewTab run={run} posts={posts} analysis={analysis} />);
    expect(screen.queryByText('Ghost')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Based on @alpha/ }));
    const dialog = screen.getByRole('dialog');
    // a1 is the middle post (900, 500, 100) of 3
    expect(within(dialog).getByText(/Post 2 of 3/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next post' }));
    expect(within(screen.getByRole('dialog')).getByText(/Post 3 of 3/)).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: /Open on Instagram/ }).getAttribute('href')).toBe(
      'https://www.instagram.com/reel/a3/',
    );
  });
});
