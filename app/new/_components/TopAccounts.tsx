'use client';

import { Icon } from '@/app/_components/Icon';
import { presetNiche, topAccountsFor } from '@/lib/niche-top-accounts';
import { fmt } from '@/lib/view';

type Props = {
  niche: string;
  client: string;
  added: string[];
  max: number;
  onAdd: (handle: string) => void;
  onRemove: (handle: string) => void;
};

// "Top accounts in <niche>" chips for niches from the suggestion list. The list
// is curated in lib/data, so it shows instantly with no Apify search.
export function TopAccounts({ niche, client, added, max, onAdd, onRemove }: Props) {
  const preset = presetNiche(niche);
  const accounts = topAccountsFor(niche);
  if (!preset) return null;
  const full = added.length >= max;

  return (
    <section className="topacc" aria-labelledby="topacc-h">
      <div className="topacc-head">
        <h2 id="topacc-h" className="topacc-title">Top accounts in {preset}</h2>
        <span className="xs muted">Click to add as a competitor · follower counts are approximate</span>
      </div>

      {accounts.length === 0 && <p className="small muted">No suggested accounts for this niche yet.</p>}

      {accounts.length > 0 && (
        <ul className="topacc-list">
          {accounts.map((a) => {
            const isAdded = added.includes(a.handle);
            const isClient = a.handle === client;
            const blocked = isClient || (!isAdded && full);
            const why = isClient ? 'This is the client' : blocked ? 'You already have 10 competitors' : undefined;
            return (
              <li key={a.handle}>
                <button
                  type="button"
                  className="topchip"
                  aria-pressed={isAdded}
                  aria-disabled={blocked || undefined}
                  aria-label={`@${a.handle}, about ${fmt(a.followers)} followers${a.verified ? ', verified' : ''}${isAdded ? ', added' : ''}`}
                  title={why ?? (a.fullName || `@${a.handle}`)}
                  onClick={() => {
                    if (blocked) return;
                    if (isAdded) onRemove(a.handle);
                    else onAdd(a.handle);
                  }}
                >
                  <Icon name={isAdded ? 'check' : 'plus'} size={15} />
                  <span className="topchip-handle">@{a.handle}</span>
                  {a.verified && <span className="topchip-verified" aria-hidden="true">✓</span>}
                  <span className="topchip-count num">~{fmt(a.followers)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
