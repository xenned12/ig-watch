import { z } from 'zod';
import type { Deps } from '@/lib/pipeline/deps';
import { rankItems } from '@/lib/rank';

const PayloadSchema = z.object({
  runId: z.string().uuid(),
  eventType: z.string(),
  apifyRunId: z.string(),
});

const FETCH_FAILED = 'Fetching posts from Instagram failed. Retry the failed step.';
const JOBS_PARTIAL = 'Some transcription jobs could not be started. If progress stops, the run will be marked failed after 30 minutes and you can retry it.';
const MIN_COMPETITORS = 3;

class FetchError extends Error {}

type Skipped = { handle: string; reason: string };

function usabilityError(
  client: string,
  competitors: string[],
  videosFound: Record<string, number>,
  skipped: Skipped[],
): string | null {
  if ((videosFound[client] ?? 0) === 0) {
    return `Your client @${client} has no video posts in the last 90 days.`;
  }
  const usable = competitors.filter((h) => (videosFound[h] ?? 0) > 0);
  if (usable.length >= MIN_COMPETITORS) return null;
  const skippedCompetitors = skipped
    .filter((s) => competitors.includes(s.handle))
    .map((s) => `@${s.handle} (${s.reason})`)
    .join(', ');
  return `Not enough usable accounts. Skipped: ${skippedCompetitors}. Add other competitors and try again.`;
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
    deps.now(),
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
  await progress.emit(runId, {
    step: 'rank',
    message: 'Kept the top 10 videos per account',
  });

  const results = await Promise.allSettled(
    stored.map((p) => deps.sendJob('/api/jobs/transcribe', { postId: p.id })),
  );
  if (results.some((r) => r.status === 'rejected')) {
    await progress.emit(runId, { step: 'transcribe', message: JOBS_PARTIAL });
  }
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
