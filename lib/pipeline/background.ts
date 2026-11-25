/**
 * Wraps work scheduled with next/server `after()` so it can never throw:
 * deps construction (missing env) and the job itself are both contained.
 * Failures are recorded on the run by the pipeline step or by the stale sweep.
 */
export function background(task: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await task();
    } catch {
      // Swallowed on purpose: the run's state machine and the 30-minute stale sweep handle failure.
    }
  };
}
