import { after } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { background } from '@/lib/pipeline/background';
import { makeDeps } from '@/lib/pipeline/deps';
import { transcribePost } from '@/lib/pipeline/transcribe';
import { checkSecret } from '@/lib/security';

// The Apify transcript actor is awaited inside this job.
export const maxDuration = 300;

const JobSchema = z.object({ postId: z.string().uuid() });

export async function POST(req: Request): Promise<Response> {
  if (!checkSecret(req.headers.get('x-webhook-secret'), serverEnv().WEBHOOK_SECRET)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const parsed = JobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid job.' }, { status: 400 });
  const { postId } = parsed.data;
  after(background(() => transcribePost(makeDeps(), postId)));
  return Response.json({ ok: true }, { status: 202 });
}
