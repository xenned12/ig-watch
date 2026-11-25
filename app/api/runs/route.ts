import { makeDeps } from '@/lib/pipeline/deps';
import { startRun } from '@/lib/pipeline/start';
import { hashIp } from '@/lib/security';

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body: unknown = await req.json().catch(() => null);
    const { status, ...rest } = await startRun(makeDeps(), body, hashIp(ip));
    return Response.json(rest, { status });
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
