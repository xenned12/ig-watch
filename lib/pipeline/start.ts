import type { Deps } from '@/lib/pipeline/deps';
import { validateRunInput } from '@/lib/handles';
import { ActiveRunExistsError } from '@/lib/store/types';

export type StartResult =
  | { status: 201; runId: string }
  | { status: 400; errors: Record<string, string> }
  | { status: 409 | 429 | 502; error: string };

const HOUR_MS = 3600_000;
const MAX_STARTS_PER_HOUR = 5;
const BUSY: StartResult = {
  status: 409,
  error: 'Another analysis is already running. Try again when it finishes.',
};
const FETCH_FAILED = 'Could not start fetching posts. Try again.';

export async function startRun(deps: Deps, input: unknown, ipHash: string): Promise<StartResult> {
  const v = validateRunInput(input);
  if (!v.ok) return { status: 400, errors: v.errors as Record<string, string> };
  const { store, progress, apify } = deps;

  const since = new Date(deps.now().getTime() - HOUR_MS).toISOString();
  if ((await store.countRecentStarts(ipHash, since)) >= MAX_STARTS_PER_HOUR) {
    return {
      status: 429,
      error: `You have started ${MAX_STARTS_PER_HOUR} analyses in the last hour. Try again later.`,
    };
  }
  if (await store.activeRun()) return BUSY;

  await store.recordStart(ipHash);
  const { niche, client, competitors } = v.value;
  let run;
  try {
    run = await store.createRun({ niche, clientHandle: client, competitorHandles: competitors });
  } catch (err) {
    if (err instanceof ActiveRunExistsError) return BUSY;
    throw err;
  }

  const handles = [client, ...competitors];
  try {
    const apifyRunId = await apify.start(handles, run.id);
    await store.updateRun(run.id, { apifyRunId });
  } catch {
    await store.updateRun(run.id, {
      status: 'failed',
      failedStep: 'fetch',
      error: FETCH_FAILED,
    });
    await progress.emit(run.id, { step: 'failed', message: FETCH_FAILED });
    return { status: 502, error: FETCH_FAILED };
  }
  await progress.emit(run.id, {
    step: 'fetch',
    message: `Run started for ${handles.length} accounts`,
  });
  return { status: 201, runId: run.id };
}
