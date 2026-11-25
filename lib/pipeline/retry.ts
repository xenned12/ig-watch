import type { Deps } from '@/lib/pipeline/deps';
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
const JOBS_PARTIAL = 'Some transcription jobs could not be started. Use retry if the run stalls.';
const CLEARED = { failedStep: null, error: null } as const;

async function retryFetch(deps: Deps, run: Run): Promise<RetryResult> {
  const { store, progress, apify } = deps;
  if (!(await store.transitionRun(run.id, 'failed', { status: 'fetching', ...CLEARED }))) {
    return NOT_FAILED;
  }
  try {
    const apifyRunId = await apify.start([run.clientHandle, ...run.competitorHandles], run.id);
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
  const patch = { status: 'analyzing', ...CLEARED, ...(remaining === undefined ? {} : { remaining }) } as const;
  if (!(await deps.store.transitionRun(run.id, 'failed', patch))) return NOT_FAILED;
  await deps.progress.emit(run.id, { step: 'analyze', message: 'Retrying: comparing transcripts' });
  await deps.sendJob('/api/jobs/analyze', { runId: run.id });
  return { status: 202 };
}

async function retryTranscribe(deps: Deps, run: Run): Promise<RetryResult> {
  const { store, progress } = deps;
  const [posts, transcripts] = await Promise.all([store.listPosts(run.id), store.listTranscripts(run.id)]);
  const done = new Set(transcripts.map((t) => t.postId));
  const missing = posts.filter((p) => !done.has(p.id));
  if (missing.length === 0) return retryAnalyze(deps, run, 0);

  const patch = { status: 'transcribing', remaining: missing.length, ...CLEARED } as const;
  if (!(await store.transitionRun(run.id, 'failed', patch))) return NOT_FAILED;
  await progress.emit(run.id, {
    step: 'transcribe',
    message: `Retrying: transcribing ${missing.length} posts`,
  });
  const results = await Promise.allSettled(
    missing.map((p) => deps.sendJob('/api/jobs/transcribe', { postId: p.id })),
  );
  if (results.some((r) => r.status === 'rejected')) {
    await progress.emit(run.id, { step: 'transcribe', message: JOBS_PARTIAL });
  }
  return { status: 202 };
}

export async function retryRun(deps: Deps, runId: string): Promise<RetryResult> {
  const run = await deps.store.getRun(runId);
  if (!run) return { status: 404, error: 'Run not found.' };
  if (run.status !== 'failed') return NOT_FAILED;
  if (await deps.store.activeRun()) return BUSY;

  switch (run.failedStep) {
    case 'transcribe':
      return retryTranscribe(deps, run);
    case 'analyze':
      return retryAnalyze(deps, run);
    default:
      return retryFetch(deps, run);
  }
}
