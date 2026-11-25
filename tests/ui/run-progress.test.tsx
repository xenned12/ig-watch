import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));

import { RunProgress } from '@/app/runs/[id]/_components/RunProgress';
import type { ProgressEvent } from '@/lib/progress';
import type { RunDetail } from '@/lib/pipeline/read';

type Run = RunDetail['run'];
const baseRun: Run = {
  id: '11111111-1111-4111-8111-111111111111',
  niche: 'AI',
  clientHandle: 'client',
  competitorHandles: ['a', 'b', 'c'],
  status: 'transcribing',
  failedStep: null,
  error: null,
  skipped: [],
  videosFound: {},
  remaining: 0,
  createdAt: '2026-11-25T10:00:00Z',
};

let emit: (e: ProgressEvent) => void = () => {};
const unsubscribe = vi.fn();
const subscribe = (cb: (e: ProgressEvent) => void) => {
  emit = cb;
  return unsubscribe;
};

function setup(status: Run['status'] = 'transcribing', events: RunDetail['events'] = []) {
  return render(
    <RunProgress run={{ ...baseRun, status }} initialEvents={events} subscribe={subscribe} />,
  );
}
const step = (name: string) => screen.getByText(name).closest('.step');

beforeEach(() => {
  refresh.mockReset();
  unsubscribe.mockReset();
  global.fetch = vi.fn() as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RunProgress', () => {
  it('renders five steps with done, active and pending states from the status', () => {
    setup('transcribing');
    expect(screen.getAllByText(/^(Fetch|Rank|Transcribe|Analyze|Write scripts)/, { selector: 'p.step-name' })).toHaveLength(5);
    expect(step('Fetch videos')?.className).toContain('done');
    expect(step('Rank')?.className).toContain('done');
    expect(step('Transcribe')?.className).toContain('active');
    expect(step('Analyze')?.className).not.toMatch(/done|active/);
    expect(step('Write scripts')?.className).not.toMatch(/done|active/);
  });

  it('marks Analyze active when analyzing', () => {
    setup('analyzing');
    expect(step('Transcribe')?.className).toContain('done');
    expect(step('Analyze')?.className).toContain('active');
  });

  it('shows the transcription counter and progress bar from an event', () => {
    setup();
    act(() => emit({ step: 'transcribe', message: 'Transcribed 12/40', transcribed: 12, total: 40 }));
    expect(screen.getByText('12/40')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('12');
  });

  it('ignores a broadcast payload without a string message', () => {
    setup('fetching', [{ at: 't', message: 'Run started' }]);
    const raw = emit as (payload: unknown) => void;
    act(() => raw({ step: 'rank', message: 42 }));
    act(() => raw(null));
    expect(screen.getByRole('log').children).toHaveLength(1);
    expect(step('Transcribe')?.className).not.toMatch(/done|active/);
  });

  it('adds each event message to the activity log', () => {
    setup('fetching', [{ at: 't', message: 'Run started' }]);
    act(() => emit({ step: 'rank', message: 'Kept the top 10 videos per account' }));
    const log = screen.getByRole('log');
    expect(log.textContent).toContain('Run started');
    expect(log.textContent).toContain('Kept the top 10 videos per account');
    expect(step('Rank')?.className).toContain('done');
  });

  it('refreshes the page on a done event', () => {
    setup();
    act(() => emit({ step: 'done', message: 'All done' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = setup();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('refetches every 15 s and refreshes once the run is no longer active', async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ run: { ...baseRun, status: 'failed' }, posts: [], events: [] }),
    });
    setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(global.fetch).toHaveBeenCalledWith(`/api/runs/${baseRun.id}`, expect.anything());
    expect(refresh).toHaveBeenCalled();
  });
});
