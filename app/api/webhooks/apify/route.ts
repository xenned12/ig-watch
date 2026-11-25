import { after } from 'next/server';
import { serverEnv } from '@/lib/env';
import { background } from '@/lib/pipeline/background';
import { makeDeps } from '@/lib/pipeline/deps';
import { handleApifyDone } from '@/lib/pipeline/webhook';
import { checkSecret } from '@/lib/security';

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!checkSecret(req.headers.get('x-webhook-secret'), serverEnv().WEBHOOK_SECRET)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  after(background(() => handleApifyDone(makeDeps(), body)));
  return Response.json({ ok: true });
}
