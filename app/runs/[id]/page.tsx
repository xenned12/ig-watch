import { notFound } from 'next/navigation';
import { Shell } from '@/app/_components/Shell';
import { runDetail, runList } from '@/lib/pipeline/read';
import { supabaseStore } from '@/lib/store/supabase';
import { Icon } from '@/app/_components/Icon';
import { RetryButton } from '../_components/RetryButton';
import { Results } from './_components/Results';
import { RunProgress } from './_components/RunProgress';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const store = supabaseStore();
  const [detail, list] = await Promise.all([runDetail(store, id), runList(store)]);
  if (!detail) notFound();
  const { run } = detail;

  return (
    <Shell active="runs" recent={list}>
      {run.status === 'done' && <Results detail={detail} />}
      {run.status === 'failed' && (
        <>
          <div className="pagehead">
            <h1>@{run.clientHandle} run failed</h1>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <p className="err">
              <Icon name="alert" size={15} />
              {run.error ?? 'Something went wrong.'}
            </p>
            <RetryButton runId={run.id} after="refresh" className="btn primary" />
          </div>
        </>
      )}
      {run.status !== 'done' && run.status !== 'failed' && <RunProgress run={run} initialEvents={detail.events} />}
    </Shell>
  );
}
