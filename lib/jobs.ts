import 'server-only';
import { serverEnv, type ServerEnv } from '@/lib/env';

/** Headers every internal callback (job routes, Apify webhook) must carry. */
export function callbackHeaders(env: ServerEnv): Record<string, string> {
  const headers: Record<string, string> = { 'x-webhook-secret': env.WEBHOOK_SECRET };
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  return headers;
}

/**
 * Dispatches a job. Job routes answer 202 as soon as the work is scheduled with
 * after(), so this only waits for the hand-off, never for the job itself.
 */
export async function sendJob(
  path: '/api/jobs/transcribe' | '/api/jobs/analyze',
  body: object,
): Promise<void> {
  const env = serverEnv();
  const res = await fetch(env.NEXT_PUBLIC_APP_URL + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...callbackHeaders(env) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Job request failed: ${res.status}`);
}
