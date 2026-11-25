import { APIFY_OUT_OF_CREDITS, OPENAI_OUT_OF_CREDITS } from '@/lib/pipeline/credits';

type RunLike = { status?: string; error?: string | null };

/**
 * The out-of-credits message to warn about, or null. Only the newest run counts,
 * so the warning clears once a run gets past the step that ran out.
 */
export function creditWarning(runs: RunLike[]): string | null {
  const newest = runs[0];
  if (newest?.status !== 'failed') return null;
  return newest.error === OPENAI_OUT_OF_CREDITS || newest.error === APIFY_OUT_OF_CREDITS ? newest.error : null;
}
