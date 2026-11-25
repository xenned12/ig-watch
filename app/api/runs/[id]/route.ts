import { z } from 'zod';
import { after } from 'next/server';
import { background } from '@/lib/pipeline/background';
import { makeDeps } from '@/lib/pipeline/deps';
import { runDetail } from '@/lib/pipeline/read';
import { pollScrape } from '@/lib/pipeline/webhook';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: 'Run not found.' }, { status: 404 });
    }
    const deps = makeDeps();
    const detail = await runDetail(deps.store, id);
    if (!detail) return Response.json({ error: 'Run not found.' }, { status: 404 });
    // The page polls this route, so it doubles as a webhook fallback and
    // carries the scraper's live status line while videos are being fetched.
    let scrapeMessage: string | null = null;
    if (detail.run.status === 'fetching') {
      scrapeMessage = await pollScrape(deps, id, (task) => after(background(task))).catch(() => null);
    }
    return Response.json({ ...detail, scrapeMessage });
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
