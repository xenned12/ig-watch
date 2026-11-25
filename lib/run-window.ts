import { defaultWindow, type DateWindow } from '@/lib/date-range';
import type { Run } from '@/lib/types';

/** The run's chosen range, or the last 90 days for runs made before ranges existed. */
export function runWindow(run: Pick<Run, 'rangeSince' | 'rangeUntil'>, now: Date): DateWindow {
  if (run.rangeSince && run.rangeUntil) return { since: run.rangeSince, until: run.rangeUntil };
  return defaultWindow(now);
}
