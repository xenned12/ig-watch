import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './Icon';
import { RecentRuns } from './RecentRuns';
import { creditWarning } from '@/lib/credit-warning';
import { AccountCard } from './AccountCard';
import { LogoutButton } from './LogoutButton';

type Active = 'new' | 'results' | 'runs';
export type RecentRun = { id: string; niche: string; clientHandle: string; status?: string; error?: string | null };

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

export function Shell({ active, recent, children }: { active: Active; /** `null` on loading screens: keep showing the last list. */
  recent: RecentRun[] | null;
  children: ReactNode }) {
  const warning = recent ? creditWarning(recent) : null;
  return (
    <div className="shell">
      <aside className="side" aria-label="Main">
        <div className="brand">
          <Icon name="play" />
          reel/intel
        </div>
        <NavLinks active={active} />
        <div className="side-sec">Recent runs</div>
        <div className="recent-list">
          <RecentRuns recent={recent} />
        </div>
        <div className="side-foot">
          <AccountCard name={process.env.APP_USERNAME || "Account"} />
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <nav className="mobilebar" aria-label="Main">
          <NavLinks active={active} />
          <LogoutButton />
        </nav>
        <main className="main" id="main">
          <div className="wrap">
            {warning && (
              <div className="credit-warn" role="alert">
                <Icon name="alert" />
                <span>{warning}</span>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
