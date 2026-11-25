import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

let params = { id: '' };
vi.mock('next/navigation', () => ({ useParams: () => params }));

import { RunSkeleton } from '@/app/runs/[id]/_components/RunSkeleton';
import { rememberStatus } from '@/lib/run-status-cache';

afterEach(cleanup);

function show(id: string) {
  params = { id };
  render(<RunSkeleton />);
  return screen.getByRole('status');
}

describe('RunSkeleton', () => {
  it.each(['fetching', 'transcribing', 'analyzing'])('shows the progress steps for a %s run', (status) => {
    rememberStatus(`run-${status}`, status);
    const el = show(`run-${status}`);
    expect(el.textContent).toBe('Loading run progress');
    expect(el.parentElement?.querySelectorAll('.steps .step')).toHaveLength(5);
    expect(el.parentElement?.querySelector('.kpis')).toBeNull();
  });

  it('shows the results layout for a finished run', () => {
    rememberStatus('run-done', 'done');
    const el = show('run-done');
    expect(el.textContent).toBe('Loading run results');
    expect(el.parentElement?.querySelectorAll('.kpi')).toHaveLength(4);
  });

  it('shows the failed layout for a failed run', () => {
    rememberStatus('run-failed', 'failed');
    expect(show('run-failed').textContent).toBe('Loading run');
  });

  it('falls back to the results layout when the status is unknown', () => {
    expect(show('never-seen').textContent).toBe('Loading run results');
  });
});
