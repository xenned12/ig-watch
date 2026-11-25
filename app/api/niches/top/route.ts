import { makeDeps } from '@/lib/pipeline/deps';
import { topAccountsForNiche } from '@/lib/pipeline/niche-top';

// A first-time search answers 202 { loading: true } while Apify searches in the
// background; the form calls again every few seconds until the list is ready.
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  try {
    const niche = new URL(req.url).searchParams.get('niche') ?? '';
    const res = await topAccountsForNiche(makeDeps(), niche);
    if (res.status === 202) return Response.json({ niche: res.niche, loading: true }, { status: 202 });
    if (res.status !== 200) return Response.json({ error: res.error }, { status: res.status });
    return Response.json({ niche: res.niche, accounts: res.accounts, cached: res.cached });
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
