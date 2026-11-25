import { notFound } from 'next/navigation';
import { Shell } from '@/app/_components/Shell';
import { runDetail, runList } from '@/lib/pipeline/read';
import { supabaseStore } from '@/lib/store/supabase';
import { Results } from './_components/Results';
import { RunProgress } from './_components/RunProgress';
import { FailedRun } from './_components/FailedRun';

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
      {run.status === 'failed' && <FailedRun run={run} />}
      {run.status !== 'done' && run.status !== 'failed' && <RunProgress run={run} initialEvents={detail.events} />}
    </Shell>
  );
}
