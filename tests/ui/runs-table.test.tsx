import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { RunsTable } from '@/app/runs/_components/RunsTable';
import type { RunListItem } from '@/lib/pipeline/read';

afterEach(cleanup);

const mk = (id: string, error: string): RunListItem => ({
  id,
  niche: 'AI',
  clientHandle: 'me',
  competitorHandles: ['a', 'b', 'c'],
  status: 'failed',
  error,
  postCount: 0,
  createdAt: '2026-11-25T00:00:00Z',
});

describe('RunsTable', () => {
  it.each([
    'Not enough usable accounts. Skipped: @a (private). Add other competitors and try again.',
    'Your client @me has no video posts in the last 90 days.',
  ])('offers Edit and re-run instead of Retry for input problems: %s', (error) => {
    render(<RunsTable runs={[mk('r1', error)]} />);
    const link = screen.getByRole('link', { name: 'Edit and re-run' });
    expect(link.getAttribute('href')).toBe('/new?from=r1');
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
  });

  it('keeps Retry for other failures', () => {
    render(<RunsTable runs={[mk('r2', 'This run stopped responding. Retry the failed step.')]} />);
    expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit and re-run' })).toBeNull();
  });
});
