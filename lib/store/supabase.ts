import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import { ActiveRunExistsError, type Store } from '@/lib/store/types';
import type { TopAccount } from '@/lib/types';
import {
  analysisFromRow, analysisToRow, postFromRow, postToRow, runFromRow,
  runPatchToRow, transcriptFromRow, transcriptToRow, type Row,
} from '@/lib/store/supabase-mappers';

type DbError = { message: string; code?: string } | null;

function check(error: DbError, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function supabaseStore(): Store {
  const env = serverEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const ACTIVE = '("done","failed")';

  return {
    async createRun(r) {
      const { data, error } = await db
        .from('runs')
        .insert({
          niche: r.niche,
          client_handle: r.clientHandle,
          competitor_handles: r.competitorHandles,
          range_since: r.rangeSince ?? null,
          range_until: r.rangeUntil ?? null,
          status: 'fetching',
        })
        .select()
        .single();
      if (error?.code === '23505') throw new ActiveRunExistsError();
      check(error, 'createRun');
      return runFromRow(data as Row);
    },
    async getRun(id) {
      const { data, error } = await db.from('runs').select().eq('id', id).maybeSingle();
      check(error, 'getRun');
      return data ? runFromRow(data as Row) : null;
    },
    async listRuns() {
      const { data, error } = await db
        .from('runs')
        .select('*, posts(count)')
        .order('created_at', { ascending: false });
      check(error, 'listRuns');
      return ((data ?? []) as Row[]).map((row) => {
        const counts = row.posts as { count: number }[] | null;
        return { ...runFromRow(row), postCount: counts?.[0]?.count ?? 0 };
      });
    },
    async activeRun() {
      const { data, error } = await db
        .from('runs')
        .select()
        .not('status', 'in', ACTIVE)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      check(error, 'activeRun');
      return data ? runFromRow(data as Row) : null;
    },
    async failStaleRuns(beforeIso) {
      const steps = [
        ['fetching', 'fetch'],
        ['transcribing', 'transcribe'],
        ['analyzing', 'analyze'],
      ] as const;
      let n = 0;
      for (const [status, step] of steps) {
        const { data, error } = await db
          .from('runs')
          .update(
            runPatchToRow({
              status: 'failed',
              failedStep: step,
              error: 'This run stopped responding. Retry the failed step.',
            }),
          )
          .eq('status', status)
          .lt('started_at', beforeIso)
          .select('id');
        check(error, 'failStaleRuns');
        n += (data ?? []).length;
      }
      return n;
    },
    async updateRun(id, patch) {
      const { error } = await db.from('runs').update(runPatchToRow(patch)).eq('id', id);
      check(error, 'updateRun');
    },
    async transitionRun(id, from, patch) {
      const { data, error } = await db
        .from('runs')
        .update(runPatchToRow(patch))
        .eq('id', id)
        .eq('status', from)
        .select('id');
      // The one-active-run unique index rejects reactivating a run while another is active.
      if (error?.code === '23505') throw new ActiveRunExistsError();
      check(error, 'transitionRun');
      return (data ?? []).length > 0;
    },
    async replacePosts(runId, posts) {
      const del = await db.from('posts').delete().eq('run_id', runId);
      check(del.error, 'replacePosts(delete)');
      if (posts.length === 0) return [];
      const { data, error } = await db
        .from('posts')
        .insert(posts.map((p) => postToRow(runId, p)))
        .select();
      check(error, 'replacePosts(insert)');
      return ((data ?? []) as Row[]).map(postFromRow);
    },
    async listPosts(runId) {
      const { data, error } = await db
        .from('posts')
        .select()
        .eq('run_id', runId)
        .order('rank', { ascending: true });
      check(error, 'listPosts');
      return ((data ?? []) as Row[]).map(postFromRow);
    },
    async getPost(id) {
      const { data, error } = await db.from('posts').select().eq('id', id).maybeSingle();
      check(error, 'getPost');
      return data ? postFromRow(data as Row) : null;
    },
    async saveTranscriptOnce(t) {
      const { data, error } = await db
        .from('transcripts')
        .upsert(transcriptToRow(t), { onConflict: 'post_id', ignoreDuplicates: true })
        .select();
      check(error, 'saveTranscriptOnce');
      return (data ?? []).length > 0;
    },
    async listTranscripts(runId) {
      const { data, error } = await db
        .from('transcripts')
        .select('*, posts!inner(run_id)')
        .eq('posts.run_id', runId);
      check(error, 'listTranscripts');
      return ((data ?? []) as Row[]).map(transcriptFromRow);
    },
    async decrementRemaining(runId) {
      const { data, error } = await db.rpc('decrement_remaining', { p_run: runId });
      check(error, 'decrementRemaining');
      if (typeof data !== 'number') throw new Error('decrementRemaining: run not found');
      return data;
    },
    async saveAnalysis(a) {
      const { error } = await db.from('analyses').upsert(analysisToRow(a), { onConflict: 'run_id' });
      check(error, 'saveAnalysis');
    },
    async getAnalysis(runId) {
      const { data, error } = await db.from('analyses').select().eq('run_id', runId).maybeSingle();
      check(error, 'getAnalysis');
      return data ? analysisFromRow(data as Row) : null;
    },
    async addEvent(runId, message) {
      const { error } = await db.from('run_events').insert({ run_id: runId, message });
      check(error, 'addEvent');
    },
    async listEvents(runId) {
      const { data, error } = await db
        .from('run_events')
        .select('at, message')
        .eq('run_id', runId)
        .order('at', { ascending: true })
        .order('id', { ascending: true });
      check(error, 'listEvents');
      return ((data ?? []) as Row[]).map((r) => ({ at: r.at as string, message: r.message as string }));
    },
    async countRecentStarts(ipHash, sinceIso) {
      const { count, error } = await db
        .from('run_starts')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', sinceIso);
      check(error, 'countRecentStarts');
      return count ?? 0;
    },
    async recordStart(ipHash) {
      const { error } = await db.from('run_starts').insert({ ip_hash: ipHash });
      check(error, 'recordStart');
    },
    async getNicheAccounts(nicheKey) {
      const { data, error } = await db
        .from('niche_top_accounts')
        .select('accounts, fetched_at, pending_run_id, pending_since')
        .eq('niche', nicheKey)
        .maybeSingle();
      check(error, 'getNicheAccounts');
      if (!data) return null;
      const row = data as Row;
      return {
        accounts: (row.accounts as TopAccount[] | null) ?? [],
        fetchedAt: (row.fetched_at as string | null) ?? null,
        pendingRunId: (row.pending_run_id as string | null) ?? null,
        pendingSince: (row.pending_since as string | null) ?? null,
      };
    },
    async saveNicheAccounts(nicheKey, accounts, fetchedAt) {
      const { error } = await db
        .from('niche_top_accounts')
        .upsert(
          { niche: nicheKey, accounts, fetched_at: fetchedAt, pending_run_id: null, pending_since: null },
          { onConflict: 'niche' },
        );
      check(error, 'saveNicheAccounts');
    },
    async setNichePending(nicheKey, runId, sinceIso) {
      const { error } = await db
        .from('niche_top_accounts')
        .upsert({ niche: nicheKey, pending_run_id: runId, pending_since: sinceIso }, { onConflict: 'niche' });
      check(error, 'setNichePending');
    },
  };
}
