import { redirect } from 'next/navigation';
import { runList } from '@/lib/pipeline/read';
import { supabaseStore } from '@/lib/store/supabase';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const runs = await runList(supabaseStore());
  const latest = runs.find((r) => r.status === 'done');
  redirect(latest ? `/runs/${latest.id}` : '/new');
}
