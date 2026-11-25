'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/app/_components/Icon';
import { NICHE_SUGGESTIONS } from '@/lib/handles';
import type { TopAccount } from '@/lib/types';
import { fmt } from '@/lib/view';

type Props = {
  niche: string;
  client: string;
  added: string[];
  max: number;
  onAdd: (handle: string) => void;
  onRemove: (handle: string) => void;
};

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; accounts: TopAccount[] }
  | { kind: 'error'; message: string };

const POLL_MS = 6_000;
const GIVE_UP_MS = 8 * 60_000;
const ERROR = 'Could not load top accounts right now. Try again.';

// "Top accounts in <niche>" chips: only for niches from the suggestion list.
// A first search for a niche runs in the background, so this polls until ready.
export function TopAccounts({ niche, client, added, max, onAdd, onRemove }: Props) {
  const preset = NICHE_SUGGESTIONS.find((n) => n.toLowerCase() === niche.trim().toLowerCase());
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!preset) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setState({ kind: 'loading' });

    async function load() {
      try {
        const res = await fetch(`/api/niches/top?niche=${encodeURIComponent(preset ?? '')}`);
        const body = (await res.json()) as { accounts?: TopAccount[]; error?: string };
        if (cancelled) return;
        if (res.status === 202) {
          if (Date.now() - startedAt > GIVE_UP_MS) setState({ kind: 'error', message: ERROR });
          else timer = setTimeout(() => void load(), POLL_MS);
          return;
        }
        if (res.ok && body.accounts) setState({ kind: 'ready', accounts: body.accounts });
        else setState({ kind: 'error', message: body.error ?? ERROR });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: ERROR });
      }
    }
    // Small delay so typing a niche doesn't fire a request per keystroke.
    timer = setTimeout(() => void load(), 300);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [preset, attempt]);

  if (!preset) return null;
  const full = added.length >= max;

  return (
    <section className="topacc" aria-labelledby="topacc-h" aria-busy={state.kind === 'loading'}>
      <div className="topacc-head">
        <h2 id="topacc-h" className="topacc-title">Top accounts in {preset}</h2>
        <span className="xs muted">Click to add as a competitor</span>
      </div>

      {state.kind === 'loading' && (
        <p className="topacc-wait small muted" role="status">
          <span className="topacc-dot" aria-hidden="true" />
          Finding top accounts… The first search for a niche takes a few minutes; after that it&apos;s instant.
        </p>
      )}

      {state.kind === 'error' && (
        <p className="err">
          <Icon name="alert" size={15} />
          {state.message}
          <button type="button" className="linkbtn" onClick={retry}>Try again</button>
        </p>
      )}

      {state.kind === 'ready' && state.accounts.length === 0 && (
        <p className="small muted">No public accounts found for this niche.</p>
      )}

      {state.kind === 'ready' && state.accounts.length > 0 && (
        <ul className="topacc-list">
          {state.accounts.map((a) => {
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
                  aria-label={`@${a.handle}, ${fmt(a.followers)} followers${a.verified ? ', verified' : ''}${isAdded ? ', added' : ''}`}
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
                  <span className="topchip-count num">{fmt(a.followers)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
