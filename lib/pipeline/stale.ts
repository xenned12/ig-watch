import type { Deps } from '@/lib/pipeline/deps';

const STALE_AFTER_MS = 30 * 60_000;

export async function failStaleRuns(deps: Deps): Promise<void> {
  const before = new Date(deps.now().getTime() - STALE_AFTER_MS).toISOString();
  await deps.store.failStaleRuns(before);
}
