import { z } from 'zod';
import { makeDeps } from '@/lib/pipeline/deps';
import { retryRun } from '@/lib/pipeline/retry';

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: 'Run not found.' }, { status: 404 });
    }
    const { status, ...rest } = await retryRun(makeDeps(), id);
    return Response.json(rest, { status });
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
