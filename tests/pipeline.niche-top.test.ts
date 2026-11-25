import { describe, expect, it, vi } from 'vitest';
import type { AccountSearch, AccountSearchResult } from '@/lib/pipeline/deps';
import { topAccountsForNiche } from '@/lib/pipeline/niche-top';
import { fakeDeps } from './fakes';

const profile = (username: string, followersCount: number | null, extra: object = {}) => ({
  username,
  fullName: username.toUpperCase(),
  followersCount,
  verified: false,
  private: false,
  ...extra,
});

// A fake Apify search: start() returns ids s1, s2…; result() follows `states`.
function fakeSearch(states: Record<string, AccountSearchResult>) {
  let n = 0;
  const search: AccountSearch & { start: ReturnType<typeof vi.fn>; result: ReturnType<typeof vi.fn> } = {
    start: vi.fn(async () => `s${++n}`),
    result: vi.fn(async (id: string) => states[id] ?? { state: 'running' }),
  };
  return search;
}

describe('topAccountsForNiche', () => {
  it('only works for niches from the suggestion list', async () => {
    expect(await topAccountsForNiche(fakeDeps(), 'Vegan baking')).toEqual({
      status: 400,
      error: 'Top accounts are only available for niches from the list.',
    });
  });

  it('first request starts one search and answers loading; repeats only check it', async () => {
    const search = fakeSearch({});
    const d = fakeDeps({ accountSearch: search });
    expect(await topAccountsForNiche(d, 'fitness')).toEqual({ status: 202, niche: 'Fitness', loading: true });
    expect(await topAccountsForNiche(d, 'Fitness')).toEqual({ status: 202, niche: 'Fitness', loading: true });
    expect(search.start).toHaveBeenCalledTimes(1);
    expect(search.start).toHaveBeenCalledWith('Fitness');
    expect(search.result).toHaveBeenCalledWith('s1');
  });

  it('when the search is done: drops private/invalid, sorts by followers, keeps 10 and caches', async () => {
    const items = [
      profile('small', 10),
      profile('secret', 9_000_000, { private: true }),
      profile('Big.One', 5_000_000),
      profile('big.one', 5_000_000),
      profile('bad name!', 8_000_000),
      profile('nocount', null),
      ...Array.from({ length: 12 }, (_, i) => profile(`acc${i}`, 1000 * (i + 1))),
    ];
    const search = fakeSearch({ s1: { state: 'done', items } });
    const d = fakeDeps({ accountSearch: search });
    await topAccountsForNiche(d, 'Fitness');
    const res = await topAccountsForNiche(d, 'Fitness');
    if (res.status !== 200) throw new Error('expected 200');
    expect(res.accounts).toHaveLength(10);
    expect(res.accounts[0]).toEqual({ handle: 'big.one', fullName: 'BIG.ONE', followers: 5_000_000, verified: false });
    expect(res.accounts.map((a) => a.handle)).not.toContain('secret');
    expect(res.accounts.map((a) => a.handle)).not.toContain('nocount');
    // Cached now: no more searching or checking.
    search.result.mockClear();
    expect(await topAccountsForNiche(d, 'FITNESS')).toMatchObject({ status: 200, cached: true });
    expect(search.result).not.toHaveBeenCalled();
    expect(search.start).toHaveBeenCalledTimes(1);
  });

  it('after 7 days it keeps showing the old list while a new search runs', async () => {
    let now = new Date('2026-11-25T00:00:00Z');
    const search = fakeSearch({ s1: { state: 'done', items: [profile('a1', 100)] } });
    const d = fakeDeps({ accountSearch: search, now: () => now });
    await topAccountsForNiche(d, 'Fitness');
    await topAccountsForNiche(d, 'Fitness');
    now = new Date('2026-12-02T00:00:01Z');
    expect(await topAccountsForNiche(d, 'Fitness')).toMatchObject({ status: 200, cached: true, accounts: [{ handle: 'a1' }] });
    expect(search.start).toHaveBeenCalledTimes(2);
  });

  it('a failed search is retried with a new one', async () => {
    const search = fakeSearch({ s1: { state: 'failed' } });
    const d = fakeDeps({ accountSearch: search });
    await topAccountsForNiche(d, 'Travel');
    expect(await topAccountsForNiche(d, 'Travel')).toEqual({ status: 202, niche: 'Travel', loading: true });
    expect(search.start).toHaveBeenCalledTimes(2);
  });

  it('a search running over 10 minutes is replaced', async () => {
    let now = new Date('2026-11-25T00:00:00Z');
    const search = fakeSearch({});
    const d = fakeDeps({ accountSearch: search, now: () => now });
    await topAccountsForNiche(d, 'Travel');
    now = new Date('2026-11-25T00:10:01Z');
    await topAccountsForNiche(d, 'Travel');
    expect(search.start).toHaveBeenCalledTimes(2);
  });

  it('502 when a search cannot be started and there is no old list', async () => {
    const d = fakeDeps({ accountSearch: { start: async () => { throw new Error('no token'); }, result: async () => ({ state: 'running' }) } });
    expect(await topAccountsForNiche(d, 'Travel')).toEqual({ status: 502, error: 'Could not load top accounts right now. Try again.' });
  });
});
