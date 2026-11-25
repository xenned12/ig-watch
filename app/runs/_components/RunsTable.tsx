'use client';

import Link from 'next/link';
import { rememberStatus } from '@/lib/run-status-cache';
import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/Icon';
import type { RunListItem } from '@/lib/pipeline/read';
import { RetryButton } from './RetryButton';

// Fetch failures caused by the chosen accounts: retrying would fail the same way, so edit instead.
const INPUT_PROBLEMS = ['No competitor could be fetched', 'Not enough usable accounts', 'Your client'];
const needsEdit = (error: string | null) => INPUT_PROBLEMS.some((p) => error?.startsWith(p) ?? false);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function StatusCell({ run }: { run: RunListItem }) {
  if (run.status === 'done') {
    return <span className="pill ok"><Icon name="check" size={15} />Done</span>;
  }
  if (run.status === 'failed') {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <span className="pill bad"><Icon name="alert" size={15} />Failed</span>
        <span className="xs muted">{run.error}</span>
        {needsEdit(run.error) ? (
          <Link className="linkbtn" href={`/new?from=${run.id}`}>Edit and re-run</Link>
        ) : (
          <RetryButton runId={run.id} after="open" className="linkbtn" />
        )}
      </span>
    );
  }
  return <span className="pill blue">In progress</span>;
}

export function RunsTable({ runs }: { runs: RunListItem[] }) {
  for (const r of runs) rememberStatus(r.id, r.status);
  const router = useRouter();
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr><th>Client</th><th>Niche</th><th>Competitors</th><th>Posts</th><th>Status</th><th>Date</th></tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const open = r.status !== 'failed';
            const href = `/runs/${r.id}`;
            return (
              <tr
                key={r.id}
                className={open ? 'click' : ''}
                {...(open
                  ? {
                      tabIndex: 0,
                      onClick: () => router.push(href),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) router.push(href);
                      },
                    }
                  : {})}
              >
                <td className="mono" style={{ color: 'var(--client)' }}>
                  {open ? (
                    <Link href={href} onClick={(e) => e.stopPropagation()}>@{r.clientHandle}</Link>
                  ) : (
                    <>@{r.clientHandle}</>
                  )}
                </td>
                <td>{r.niche}</td>
                <td className="small muted">{r.competitorHandles.map((c) => `@${c}`).join(', ')}</td>
                <td className="num">{r.postCount || '—'}</td>
                <td><StatusCell run={r} /></td>
                <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
