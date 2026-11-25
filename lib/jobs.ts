import 'server-only';
import { serverEnv } from '@/lib/env';

export async function sendJob(
  path: '/api/jobs/transcribe' | '/api/jobs/analyze',
  body: object,
): Promise<void> {
  const env = serverEnv();
  const res = await fetch(env.NEXT_PUBLIC_APP_URL + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': env.WEBHOOK_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`Job request failed: ${res.status}`);
}
