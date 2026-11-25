import { z } from 'zod';
import type { Deps } from '@/lib/pipeline/deps';
import { dispatchTranscribeJobs } from '@/lib/pipeline/dispatch';
import { rankItems } from '@/lib/rank';
import { runWindow } from '@/lib/run-window';

const PayloadSchema = z.object({
  runId: z.string().uuid(),
  eventType: z.string(),
  apifyRunId: z.string(),
});

const FETCH_FAILED = 'Fetching posts from Instagram failed. Retry the failed step.';

class FetchError extends Error {}

type Skipped = { handle: string; reason: string };

function usabilityError(
  client: string,
  competitors: string[],
  videosFound: Record<string, number>,
  skipped: Skipped[],
): string | null {
  if ((videosFound[client] ?? 0) === 0) {
    const reason = skipped.find((s) => s.handle === client)?.reason;
    // Only say "no video posts" when that is the actual reason.
    if (reason && !reason.startsWith('No video posts')) return `Your client @${client} could not be fetched: ${reason}.`;
    return `Your client @${client} has no video posts in the selected dates.`;
  }
  // Carry on with whichever competitors worked; fail only when none did.
  if (competitors.some((h) => (videosFound[h] ?? 0) > 0)) return null;
  return `No competitor could be fetched. Skipped: ${skippedList(competitors, skipped)}. Add other competitors and try again.`;
}

function skippedList(competitors: string[], skipped: Skipped[]): string {
  return skipped
    .filter((s) => competitors.includes(s.handle))
    .map((s) => `@${s.handle} (${s.reason})`)
    .join(', ');
}

async function runPipeline(deps: Deps, runId: string, eventType: string, apifyRunId: string) {
  const { store, progress, apify } = deps;
  if (eventType !== 'ACTOR.RUN.SUCCEEDED') throw new FetchError(FETCH_FAILED);
  const run = await store.getRun(runId);
  if (!run) throw new FetchError(FETCH_FAILED);

  const items = await apify.items(apifyRunId);
  const { posts, videosFound, skipped } = rankItems(
    items,
    { client: run.clientHandle, competitors: run.competitorHandles },
    runWindow(run, deps.now()),
  );
  const problem = usabilityError(run.clientHandle, run.competitorHandles, videosFound, skipped);
  if (problem) throw new FetchError(problem);

  const stored = await store.replacePosts(runId, posts);
  await store.updateRun(runId, {
    videosFound,
    skipped,
    remaining: stored.length,
  });
  await progress.emit(runId, {
    step: 'fetch',
    message: `Fetched posts for ${Object.keys(videosFound).length} accounts`,
  });
  const missed = skippedList(run.competitorHandles, skipped);
  if (missed) {
    await progress.emit(runId, {
      step: 'fetch',
      message: `Skipped ${missed}. Continuing with the other accounts.`,
    });
  }
  await progress.emit(runId, {
    step: 'rank',
    message: 'Kept the top 10 videos per account',
  });

  await dispatchTranscribeJobs(deps, runId, stored.map((p) => p.id));
}

async function fail(deps: Deps, runId: string, error: string): Promise<void> {
  try {
    await deps.store.updateRun(runId, {
      status: 'failed',
      failedStep: 'fetch',
      error,
    });
    await deps.progress.emit(runId, { step: 'failed', message: error });
  } catch {
    // Nothing more can be done; the run stays visible via its last stored state.
  }
}

export async function handleApifyDone(deps: Deps, payload: unknown): Promise<void> {
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) return;
  const { runId, eventType, apifyRunId } = parsed.data;
  try {
    // A webhook from an earlier Apify attempt must not claim a retried run.
    const run = await deps.store.getRun(runId);
    if (!run || run.apifyRunId !== apifyRunId) return;
    const claimed = await deps.store.transitionRun(runId, 'fetching', {
      status: 'transcribing',
    });
    if (!claimed) return;
  } catch {
    return;
  }
  try {
    await runPipeline(deps, runId, eventType, apifyRunId);
  } catch (err) {
    await fail(deps, runId, err instanceof FetchError ? err.message : FETCH_FAILED);
  }
}

/**
 * Fallback for when Apify's webhook cannot reach the app (local dev): asks the
 * scraper whether the scrape has finished and, if so, handles it like the webhook
 * (via `defer`, so callers can run it after responding). Returns the scraper's
 * live status message for display. Safe alongside the webhook: handleApifyDone
 * claims the run only once.
 */
export async function pollScrape(
  deps: Deps,
  runId: string,
  defer: (task: () => Promise<void>) => Promise<void> | void = (task) => task(),
): Promise<string | null> {
  const run = await deps.store.getRun(runId);
  if (!run || run.status !== 'fetching' || !run.apifyRunId || !deps.apify.status) return null;
  const apifyRunId = run.apifyRunId;
  const { event, message } = await deps.apify.status(apifyRunId);
  if (event) await defer(() => handleApifyDone(deps, { runId, eventType: event, apifyRunId }));
  return message;
}
