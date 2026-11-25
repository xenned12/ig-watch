import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import type { Store } from '@/lib/store/types';
import type { Step } from '@/lib/types';

export type ProgressEvent = {
  step: Step | 'rank' | 'done' | 'failed';
  message: string;
  transcribed?: number;
  total?: number;
};

export interface Progress {
  emit(runId: string, e: ProgressEvent): Promise<void>;
}

async function broadcast(runId: string, e: ProgressEvent): Promise<void> {
  const env = serverEnv();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const ch = client.channel(`run:${runId}`);
  try {
    const res = await ch.httpSend('progress', e);
    if (!res.success) throw new Error(`Progress broadcast failed: ${res.status}`);
  } finally {
    await client.removeChannel(ch);
  }
}

export function supabaseProgress(store: Store): Progress {
  return {
    async emit(runId, e) {
      await store.addEvent(runId, e.message);
      try {
        await broadcast(runId, e);
      } catch {
        // UI-only: the progress page refetches every 15 s, so a lost broadcast must not abort the pipeline.
      }
    },
  };
}
