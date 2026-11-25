import data from '@/lib/data/niche-top-accounts.json';
import { NICHE_SUGGESTIONS } from '@/lib/handles';
import type { TopAccount } from '@/lib/types';

// Curated top Instagram accounts per preset niche, researched from public
// rankings and lists (Nov 2026). Follower counts are approximate and are not
// fetched live: this replaces the Apify account search for the test app.
const ACCOUNTS = data as Record<string, TopAccount[]>;

/** The preset niche matching `niche` (any case), or null for a custom niche. */
export function presetNiche(niche: string): string | null {
  return NICHE_SUGGESTIONS.find((n) => n.toLowerCase() === niche.trim().toLowerCase()) ?? null;
}

/** Up to 10 accounts for a preset niche, most followers first; [] for any other niche. */
export function topAccountsFor(niche: string): TopAccount[] {
  const preset = presetNiche(niche);
  return preset ? (ACCOUNTS[preset] ?? []) : [];
}
