import { APIFY_OUT_OF_CREDITS, isApifyOutOfCredits } from '@/lib/pipeline/credits';
import type { Deps } from '@/lib/pipeline/deps';
import { defaultWindow, validateWindow } from '@/lib/date-range';
import { validateRunInput } from '@/lib/handles';
import { failStaleRuns } from '@/lib/pipeline/stale';
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
const FETCH_START_FAILED = 'Could not start fetching posts. Try again.';

export async function startRun(deps: Deps, input: unknown, ipHash: string): Promise<StartResult> {
  const v = validateRunInput(input);
  const rawRange = typeof input === 'object' && input !== null ? (input as { range?: unknown }).range : undefined;
  // No range sent (older clients): use the last 90 days, as before.
  const w = rawRange === undefined ? { ok: true as const, value: defaultWindow(deps.now()) } : validateWindow(rawRange, deps.now());
  if (!v.ok || !w.ok) {
    const errors = { ...(v.ok ? {} : v.errors), ...(w.ok ? {} : { range: w.error }) };
    return { status: 400, errors: errors as Record<string, string> };
  }
  const window = w.value;
  const { store, progress, apify } = deps;
  await failStaleRuns(deps);

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
    run = await store.createRun({
      niche,
      clientHandle: client,
      competitorHandles: competitors,
      rangeSince: window.since,
      rangeUntil: window.until,
    });
  } catch (err) {
    if (err instanceof ActiveRunExistsError) return BUSY;
    throw err;
  }

  const handles = [client, ...competitors];
  try {
    const apifyRunId = await apify.start(handles, run.id, window);
    await store.updateRun(run.id, { apifyRunId });
  } catch (err) {
    console.error(`[fetch] run ${run.id} could not start: ${String(err)}`);
    const message = isApifyOutOfCredits(err) ? APIFY_OUT_OF_CREDITS : FETCH_START_FAILED;
    await store.updateRun(run.id, {
      status: 'failed',
      failedStep: 'fetch',
      error: message,
    });
    await progress.emit(run.id, { step: 'failed', message });
    return { status: 502, error: message };
  }
  await progress.emit(run.id, {
    step: 'fetch',
    message: `Run started for ${handles.length} accounts`,
  });
  return { status: 201, runId: run.id };
}
