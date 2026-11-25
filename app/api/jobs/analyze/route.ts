import { after } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { analyzeRun } from '@/lib/pipeline/analyze';
import { background } from '@/lib/pipeline/background';
import { makeDeps } from '@/lib/pipeline/deps';
import { checkSecret } from '@/lib/security';

// 300 s requires Vercel Fluid compute (the default for new projects); see README.
export const maxDuration = 300;

const JobSchema = z.object({ runId: z.string().uuid() });

export async function POST(req: Request): Promise<Response> {
  if (!checkSecret(req.headers.get('x-webhook-secret'), serverEnv().WEBHOOK_SECRET)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const parsed = JobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid job.' }, { status: 400 });
  const { runId } = parsed.data;
  after(background(() => analyzeRun(makeDeps(), runId)));
  return Response.json({ ok: true }, { status: 202 });
}
