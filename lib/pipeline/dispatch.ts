import type { Deps } from '@/lib/pipeline/deps';
import { transcribePost } from '@/lib/pipeline/transcribe';

export type Defer = (task: () => Promise<void>) => Promise<void> | void;
const inline: Defer = (task) => task();

async function sendAll(deps: Deps, ids: string[]): Promise<string[]> {
  const results = await Promise.allSettled(
    ids.map((postId) => deps.sendJob('/api/jobs/transcribe', { postId })),
  );
  return ids.filter((_, i) => results[i].status === 'rejected');
}

/**
 * Queues one transcription job per post. A job that fails to queue is sent once
 * more; any that still fail are transcribed directly (via `defer`) so the run
 * never stalls waiting on a job that was never started.
 */
export async function dispatchTranscribeJobs(
  deps: Deps,
  runId: string,
  postIds: string[],
  defer: Defer = inline,
): Promise<{ queued: number; direct: number }> {
  const firstMiss = await sendAll(deps, postIds);
  const stillMissing = firstMiss.length ? await sendAll(deps, firstMiss) : [];
  if (stillMissing.length) {
    const n = stillMissing.length;
    await deps.progress.emit(runId, {
      step: 'transcribe',
      message:
        n === 1
          ? '1 transcription job could not be queued, so it is being transcribed directly.'
          : `${n} transcription jobs could not be queued, so they are being transcribed directly.`,
    });
    await defer(async () => {
      for (const id of stillMissing) {
        try {
          await transcribePost(deps, id);
        } catch {
          // transcribePost already falls back to the caption; keep going with the rest.
        }
      }
    });
  }
  return { queued: postIds.length - stillMissing.length, direct: stillMissing.length };
}
