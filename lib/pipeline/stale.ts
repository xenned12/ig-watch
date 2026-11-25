import type { Deps } from '@/lib/pipeline/deps';
import type { Store } from '@/lib/store/types';

const STALE_AFTER_MS = 30 * 60_000;

/** Marks active runs whose current step started more than 30 minutes ago as failed. */
export async function sweepStaleRuns(store: Store, now: Date): Promise<void> {
  const before = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  await store.failStaleRuns(before);
}

export async function failStaleRuns(deps: Deps): Promise<void> {
  await sweepStaleRuns(deps.store, deps.now());
}
