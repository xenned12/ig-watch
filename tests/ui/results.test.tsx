import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { RunDetail } from '@/lib/pipeline/read';

const replace = vi.fn();
const router = { replace, push: vi.fn(), prefetch: vi.fn() };
let tab: string | null = null;
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/runs/r1',
  useSearchParams: () => new URLSearchParams(tab ? `tab=${tab}` : ''),
}));

import { Results } from '@/app/runs/[id]/_components/Results';

const detail = (analysis: RunDetail['analysis']): RunDetail => ({
  run: {
    id: 'r1', niche: 'AI', clientHandle: 'client', competitorHandles: ['alpha'], status: 'done', failedStep: null,
    error: null, skipped: [], videosFound: {}, remaining: 0, createdAt: '2026-11-25T00:00:00Z', rangeSince: null, rangeUntil: null,
  },
  posts: [
    { id: 'a', runId: 'r1', handle: 'alpha', isClient: false, igUrl: 'https://x/a', postedAt: '2026-10-01T00:00:00Z', views: 100, likes: 1, comments: 1, durationS: 30, rankMetric: 'views', rank: 1, videoUrl: null, caption: 'c', transcript: null },
    { id: 'b', runId: 'r1', handle: 'client', isClient: true, igUrl: 'https://x/b', postedAt: '2026-10-01T00:00:00Z', views: 50, likes: 1, comments: 1, durationS: 20, rankMetric: 'views', rank: 1, videoUrl: null, caption: 'c', transcript: null },
  ],
  analysis,
  events: [],
});

afterEach(() => {
  cleanup();
  replace.mockClear();
  tab = null;
});

describe('Results', () => {
  it('moves between tabs with the arrow keys using router.replace', () => {
    render(<Results detail={detail({ runId: 'r1', patterns: [], gaps: [], recommendations: [], scripts: [] })} />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(replace).toHaveBeenCalledWith('/runs/r1?tab=posts', { scroll: false });
  });

  it('links Re-run to /new?from=<id>', () => {
    render(<Results detail={detail({ runId: 'r1', patterns: [], gaps: [], recommendations: [], scripts: [] })} />);
    expect(screen.getByRole('link', { name: /Re-run/ }).getAttribute('href')).toBe('/new?from=r1');
  });

  it('shows the posts tab and a notice when the analysis is missing', () => {
    render(<Results detail={detail(null)} />);
    expect(screen.getByText('The analysis is missing for this run. Retry the failed step from Runs.')).toBeTruthy();
    expect(screen.getByLabelText('Search transcripts')).toBeTruthy();
  });
});
