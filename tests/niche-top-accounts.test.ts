import { describe, expect, it } from 'vitest';
import data from '@/lib/data/niche-top-accounts.json';
import { HANDLE_RE, NICHE_SUGGESTIONS } from '@/lib/handles';
import { topAccountsFor } from '@/lib/niche-top-accounts';

const lists = data as Record<string, { handle: string; followers: number }[]>;

describe('curated top accounts', () => {
  it('has a list for every preset niche and nothing else', () => {
    expect(Object.keys(lists).sort()).toEqual([...NICHE_SUGGESTIONS].sort());
  });

  it.each(NICHE_SUGGESTIONS)('%s: 1–10 valid, unique handles, most followers first', (niche) => {
    const list = lists[niche];
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(10);
    for (const a of list) expect(HANDLE_RE.test(a.handle)).toBe(true);
    expect(new Set(list.map((a) => a.handle)).size).toBe(list.length);
    const counts = list.map((a) => a.followers);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
  });

  it('matches niches in any case and returns nothing for custom niches', () => {
    expect(topAccountsFor('fitness')).toEqual(lists.Fitness);
    expect(topAccountsFor('Vegan baking')).toEqual([]);
  });
});
