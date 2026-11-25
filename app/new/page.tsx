import { Shell } from '@/app/_components/Shell';
import { runDetail, runList } from '@/lib/pipeline/read';
import { supabaseStore } from '@/lib/store/supabase';
import { NewRunForm, type NewRunInitial } from './_components/NewRunForm';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const store = supabaseStore();
  const recent = await runList(store);

  let initial: NewRunInitial | undefined;
  if (from && UUID_RE.test(from)) {
    const detail = await runDetail(store, from);
    if (detail) {
      const { niche, clientHandle, competitorHandles } = detail.run;
      initial = { niche, client: clientHandle, competitors: competitorHandles };
    }
  }

  return (
    <Shell active="new" recent={recent}>
      <NewRunForm initial={initial} />
    </Shell>
  );
}
