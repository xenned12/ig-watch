import Link from 'next/link';
import { Shell } from '@/app/_components/Shell';
import { runList } from '@/lib/pipeline/read';
import { supabaseStore } from '@/lib/store/supabase';
import { Icon } from '@/app/_components/Icon';
import { RunsTable } from './_components/RunsTable';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const runs = await runList(supabaseStore());
  return (
    <Shell active="runs" recent={runs.slice(0, 3)}>
      <div className="pagehead">
        <div>
          <h1>Runs</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            Every analysis you&apos;ve started. One run can be in progress at a time.
          </p>
        </div>
        <Link className="btn primary" href="/new">
          <Icon name="plus" size={15} />
          New analysis
        </Link>
      </div>
      {runs.length === 0 ? (
        <div className="empty card">
          <h2>Start your first analysis</h2>
          <p className="muted">Compare a client&apos;s top reels with its competitors&apos;.</p>
          <Link className="btn primary" href="/new">New analysis</Link>
        </div>
      ) : (
        <RunsTable runs={runs} />
      )}
    </Shell>
  );
}
