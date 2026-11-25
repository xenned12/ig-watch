import type { Deps } from '@/lib/pipeline/deps';
import { dispatchTranscribeJobs, type Defer } from '@/lib/pipeline/dispatch';
import { failStaleRuns } from '@/lib/pipeline/stale';
import { runWindow } from '@/lib/run-window';
import { ActiveRunExistsError } from '@/lib/store/types';
import type { Run } from '@/lib/types';

export type RetryResult =
  | { status: 202 }
  | { status: 404 | 409 | 502; error: string };

const NOT_FAILED: RetryResult = { status: 409, error: 'Only failed runs can be retried.' };
const BUSY: RetryResult = {
  status: 409,
  error: 'Another analysis is already running. Try again when it finishes.',
};
const FETCH_FAILED = 'Could not start fetching posts. Try again.';
const ANALYZE_FAILED = 'Could not start the analysis. Retry the failed step.';
const CLEARED = { failedStep: null, error: null } as const;

async function retryFetch(deps: Deps, run: Run): Promise<RetryResult> {
  const { store, progress, apify } = deps;
  if (!(await store.transitionRun(run.id, 'failed', { status: 'fetching', startedAt: deps.now().toISOString(), ...CLEARED }))) {
    return NOT_FAILED;
  }
  try {
    const apifyRunId = await apify.start([run.clientHandle, ...run.competitorHandles], run.id, runWindow(run, deps.now()));
    await store.updateRun(run.id, { apifyRunId });
  } catch {
    await store.updateRun(run.id, { status: 'failed', failedStep: 'fetch', error: FETCH_FAILED });
    await progress.emit(run.id, { step: 'failed', message: FETCH_FAILED });
    return { status: 502, error: FETCH_FAILED };
  }
  await progress.emit(run.id, { step: 'fetch', message: 'Retrying: fetching posts' });
  return { status: 202 };
}

async function retryAnalyze(deps: Deps, run: Run, remaining?: number): Promise<RetryResult> {
  const patch = { status: 'analyzing', startedAt: deps.now().toISOString(), ...CLEARED, ...(remaining === undefined ? {} : { remaining }) } as const;
  if (!(await deps.store.transitionRun(run.id, 'failed', patch))) return NOT_FAILED;
  await deps.progress.emit(run.id, { step: 'analyze', message: 'Retrying: comparing transcripts' });
  try {
    await deps.sendJob('/api/jobs/analyze', { runId: run.id });
  } catch {
    await deps.store.updateRun(run.id, { status: 'failed', failedStep: 'analyze', error: ANALYZE_FAILED });
    await deps.progress.emit(run.id, { step: 'failed', message: ANALYZE_FAILED });
    return { status: 502, error: ANALYZE_FAILED };
  }
  return { status: 202 };
}

async function retryTranscribe(deps: Deps, run: Run, defer?: Defer): Promise<RetryResult> {
  const { store, progress } = deps;
  const [posts, transcripts] = await Promise.all([store.listPosts(run.id), store.listTranscripts(run.id)]);
  const done = new Set(transcripts.map((t) => t.postId));
  const missing = posts.filter((p) => !done.has(p.id));
  if (missing.length === 0) return retryAnalyze(deps, run, 0);

  const patch = {
    status: 'transcribing',
    startedAt: deps.now().toISOString(),
    remaining: missing.length,
    ...CLEARED,
  } as const;
  if (!(await store.transitionRun(run.id, 'failed', patch))) return NOT_FAILED;
  await progress.emit(run.id, {
    step: 'transcribe',
    message: `Retrying: transcribing ${missing.length} posts`,
  });
  // Jobs that cannot be queued are transcribed directly, so the retry never stalls.
  await dispatchTranscribeJobs(deps, run.id, missing.map((p) => p.id), defer);
  return { status: 202 };
}

export async function retryRun(deps: Deps, runId: string, defer?: Defer): Promise<RetryResult> {
  await failStaleRuns(deps);
  const run = await deps.store.getRun(runId);
  if (!run) return { status: 404, error: 'Run not found.' };
  if (run.status !== 'failed') return NOT_FAILED;
  if (await deps.store.activeRun()) return BUSY;

  try {
    return await dispatch(deps, run, defer);
  } catch (err) {
    if (err instanceof ActiveRunExistsError) return BUSY;
    throw err;
  }
}

async function dispatch(deps: Deps, run: Run, defer?: Defer): Promise<RetryResult> {
  // Without stored posts there is nothing to transcribe or analyze: start over from fetch.
  const hasPosts = (await deps.store.listPosts(run.id)).length > 0;
  if (hasPosts && run.failedStep === 'transcribe') return retryTranscribe(deps, run, defer);
  if (hasPosts && run.failedStep === 'analyze') return retryAnalyze(deps, run);
  return retryFetch(deps, run);
}
