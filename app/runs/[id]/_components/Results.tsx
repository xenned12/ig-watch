'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/app/_components/Icon';
import type { RunDetail } from '@/lib/pipeline/read';
import { fmt, fmtDate, kpis } from '@/lib/view';
import { OverviewTab } from './OverviewTab';
import { PostsTab } from './PostsTab';
import { ScriptsTab } from './ScriptsTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'posts', label: 'Posts and transcripts' },
  { key: 'scripts', label: 'Scripts' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function Results({ detail }: { detail: RunDetail }) {
  const { run, posts, analysis } = detail;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const param = search.get('tab');
  const tab: TabKey = TABS.find((t) => t.key === param)?.key ?? 'overview';
  const n = run.competitorHandles.length;

  function go(next: TabKey) {
    const p = new URLSearchParams(search.toString());
    if (next === 'overview') p.delete('tab');
    else p.set('tab', next);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onKey(e: KeyboardEvent, i: number) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length].key;
    go(next);
    refs.current[next]?.focus();
  }

  const k = analysis ? kpis(posts, analysis) : null;
  const top = k?.topPattern;

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">
            <span>{run.niche} niche</span><span>·</span>
            <span>{fmtDate(run.createdAt, true)}</span><span>·</span>
            <span>last 90 days</span>
          </p>
          <h1>@{run.clientHandle} vs {n} competitor{n === 1 ? '' : 's'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href={`/new?from=${run.id}`}>
            <Icon name="retry" size={15} />
            Re-run
          </Link>
          {analysis && (
            <button className="btn primary" onClick={() => go('scripts')}>View scripts</button>
          )}
        </div>
      </div>

      {k && analysis ? (
        <>
          <div className="kpis">
            <div className="kpi">
              <p className="xs muted">Competitor median views</p>
              <p className="v">{fmt(k.compMedian)}</p>
              <p className="cmp muted">across {posts.filter((p) => !p.isClient).length} top reels</p>
            </div>
            <div className="kpi">
              <p className="xs muted">Client median views</p>
              <p className="v" style={{ color: 'var(--client)' }}>{fmt(k.clientMedian)}</p>
              <p className="cmp" style={{ color: k.gapPct < 0 ? 'var(--bad)' : 'var(--ok)' }}>{k.gapPct}% vs competitors</p>
            </div>
            <div className="kpi">
              <p className="xs muted">Average reel length</p>
              <p className="v">
                {k.compAvgLen}s <span className="muted" style={{ fontSize: 14 }}>vs</span>{' '}
                <span style={{ color: 'var(--client)' }}>{k.clientAvgLen}s</span>
              </p>
              <p className="cmp muted">competitors vs client</p>
            </div>
            {top && (
              <div className="kpi">
                <p className="xs muted">{top.name}</p>
                <p className="v">
                  {top.competitorCount * 10}% <span className="muted" style={{ fontSize: 14 }}>vs</span>{' '}
                  <span style={{ color: 'var(--client)' }}>{top.clientCount * 10}%</span>
                </p>
                <p className="cmp muted">competitors vs client</p>
              </div>
            )}
          </div>
          <div className="tabs" role="tablist" aria-label="Results">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                ref={(el) => {
                  refs.current[t.key] = el;
                }}
                role="tab"
                className="tab"
                id={`tab-${t.key}`}
                aria-controls="panel"
                aria-selected={tab === t.key}
                tabIndex={tab === t.key ? 0 : -1}
                onClick={() => go(t.key)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {t.label}
                {t.key === 'posts' && <> <span className="pill grey num">{posts.length}</span></>}
              </button>
            ))}
          </div>
          <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'overview' && <OverviewTab run={run} posts={posts} analysis={analysis} />}
            {tab === 'posts' && <PostsTab run={run} posts={posts} />}
            {tab === 'scripts' && <ScriptsTab clientHandle={run.clientHandle} scripts={analysis.scripts} />}
          </div>
        </>
      ) : (
        <>
          <div className="notice">
            <Icon name="alert" size={15} />
            <span>The analysis is missing for this run. Retry the failed step from Runs.</span>
          </div>
          <PostsTab run={run} posts={posts} />
        </>
      )}
    </>
  );
}
