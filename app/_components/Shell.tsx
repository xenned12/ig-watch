import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './Icon';

type Active = 'new' | 'results' | 'runs';
export type RecentRun = { id: string; niche: string; clientHandle: string };

const NAV: { key: Active; label: string; href: string; icon: IconName }[] = [
  { key: 'new', label: 'New analysis', href: '/new', icon: 'plus' },
  { key: 'results', label: 'Latest results', href: '/', icon: 'chart' },
  { key: 'runs', label: 'Runs', href: '/runs', icon: 'list' },
];

function NavLinks({ active }: { active: Active }) {
  return NAV.map((n) => (
    <Link key={n.key} className="nav" href={n.href} aria-current={active === n.key ? 'page' : undefined}>
      <Icon name={n.icon} />
      {n.label}
    </Link>
  ));
}

export function Shell({ active, recent, children }: { active: Active; recent: RecentRun[]; children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="side" aria-label="Main">
        <div className="brand">
          <Icon name="play" />
          reel/intel
        </div>
        <NavLinks active={active} />
        <div className="side-sec">Recent runs</div>
        {recent.map((r) => (
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
        ))}
        <p className="side-foot xs muted">Reel Intel</p>
      </aside>
      <div style={{ minWidth: 0 }}>
        <nav className="mobilebar" aria-label="Main">
          <NavLinks active={active} />
        </nav>
        <main className="main" id="main">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </div>
  );
}
