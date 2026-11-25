import { z } from 'zod';
import { makeDeps } from '@/lib/pipeline/deps';
import { runDetail } from '@/lib/pipeline/read';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: 'Run not found.' }, { status: 404 });
    }
    const detail = await runDetail(makeDeps().store, id);
    if (!detail) return Response.json({ error: 'Run not found.' }, { status: 404 });
    return Response.json(detail);
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
