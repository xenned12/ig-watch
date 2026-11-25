'use client';

import Link from 'next/link';
import { rememberStatus } from '@/lib/run-status-cache';
import type { RecentRun } from './Shell';

// Last list a page rendered. Loading screens pass `null` and reuse it, so the
// sidebar keeps its runs while the next page fetches its data.
let lastSeen: RecentRun[] = [];

export function RecentRuns({ recent }: { recent: RecentRun[] | null }) {
  if (recent) lastSeen = recent;
  for (const r of recent ?? []) rememberStatus(r.id, r.status);
  return (recent ?? lastSeen).map((r) => (
    // Two lines that each truncate on their own; the full text is in the
    // accessible name and the native tooltip.
    <Link
      key={r.id}
      className="recent"
      href={`/runs/${r.id}`}
      aria-label={`@${r.clientHandle}, ${r.niche}`}
      title={`@${r.clientHandle} · ${r.niche}`}
    >
      <span className="recent-avatar" aria-hidden="true">{r.clientHandle.charAt(0)}</span>
      <span className="recent-text" aria-hidden="true">
        <span className="recent-handle">@{r.clientHandle}</span>
        <span className="recent-niche">{r.niche}</span>
      </span>
    </Link>
  ));
}
