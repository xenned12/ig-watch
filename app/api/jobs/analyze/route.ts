import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { analyzeRun } from '@/lib/pipeline/analyze';
import { makeDeps } from '@/lib/pipeline/deps';
import { checkSecret } from '@/lib/security';

export const maxDuration = 60;

const JobSchema = z.object({ runId: z.string().uuid() });

export async function POST(req: Request): Promise<Response> {
  if (!checkSecret(req.headers.get('x-webhook-secret'), serverEnv().WEBHOOK_SECRET)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const parsed = JobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid job.' }, { status: 400 });
  try {
    await analyzeRun(makeDeps(), parsed.data.runId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
