import { z } from 'zod';
import { HANDLE_RE, NICHE_SUGGESTIONS, normaliseHandle } from '@/lib/handles';
import type { TopAccount } from '@/lib/types';
import type { Deps } from './deps';

export const TOP_ACCOUNTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_GIVE_UP_MS = 10 * 60 * 1000;
const TOP_N = 10;

export type TopAccountsResult =
  | { status: 200; niche: string; accounts: TopAccount[]; cached: boolean }
  | { status: 202; niche: string; loading: true }
  | { status: 400 | 502; error: string };

// One profile from the account search; unknown extra fields are ignored.
const Profile = z
  .object({
    username: z.string(),
    fullName: z.string().nullish(),
    followersCount: z.number().nullish(),
    verified: z.boolean().nullish(),
    private: z.boolean().nullish(),
  })
  .passthrough();

export function pickTopAccounts(items: unknown[]): TopAccount[] {
  const seen = new Set<string>();
  const out: TopAccount[] = [];
  for (const raw of items) {
    const p = Profile.safeParse(raw);
    if (!p.success) continue;
    const handle = normaliseHandle(p.data.username);
    const followers = p.data.followersCount;
    if (!HANDLE_RE.test(handle) || seen.has(handle) || p.data.private || typeof followers !== 'number') continue;
    seen.add(handle);
    out.push({ handle, fullName: p.data.fullName ?? '', followers, verified: p.data.verified ?? false });
  }
  return out.sort((a, b) => b.followers - a.followers).slice(0, TOP_N);
}

// Top accounts for a preset niche. The Apify search runs in the background:
// the first request starts it (202 loading), later requests check the same
// search, and its result is cached for 7 days. Custom niches are refused.
export async function topAccountsForNiche(deps: Deps, rawNiche: string): Promise<TopAccountsResult> {
  const niche = NICHE_SUGGESTIONS.find((n) => n.toLowerCase() === rawNiche.trim().toLowerCase());
  if (!niche) return { status: 400, error: 'Top accounts are only available for niches from the list.' };

  const key = niche.toLowerCase();
  const now = deps.now();
  const row = await deps.store.getNicheAccounts(key);
  const hasList = !!row?.fetchedAt && row.accounts.length > 0;
  const fresh = hasList && now.getTime() - Date.parse(row.fetchedAt ?? '') < TOP_ACCOUNTS_TTL_MS;
  const stale = (): TopAccountsResult => ({ status: 200, niche, accounts: row?.accounts ?? [], cached: true });

  if (fresh) return stale();

  // A search is already running: check it instead of starting another.
  if (row?.pendingRunId) {
    const tooOld = now.getTime() - Date.parse(row.pendingSince ?? '') > SEARCH_GIVE_UP_MS;
    const result = tooOld ? { state: 'failed' as const } : await deps.accountSearch.result(row.pendingRunId);
    if (result.state === 'done') {
      const accounts = pickTopAccounts(result.items);
      if (accounts.length > 0) await deps.store.saveNicheAccounts(key, accounts, now.toISOString());
      else await deps.store.setNichePending(key, null, null);
      return { status: 200, niche, accounts: accounts.length > 0 ? accounts : row.accounts, cached: false };
    }
    if (result.state === 'running') return hasList ? stale() : { status: 202, niche, loading: true };
    // Failed or too old: fall through and start a new search.
  }

  try {
    const searchId = await deps.accountSearch.start(niche);
    await deps.store.setNichePending(key, searchId, now.toISOString());
  } catch {
    return hasList ? stale() : { status: 502, error: 'Could not load top accounts right now. Try again.' };
  }
  return hasList ? stale() : { status: 202, niche, loading: true };
}
