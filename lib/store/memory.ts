import type { Analysis, Post, Run, RunStatus, Step, Transcript } from '@/lib/types';
import { ActiveRunExistsError, type NewPost, type NewRun, type RunEvent, type Store } from '@/lib/store/types';

const STALE_STEP: Record<string, Step> = {
  fetching: 'fetch',
  transcribing: 'transcribe',
  analyzing: 'analyze',
};
const STALE_ERROR = 'This run stopped responding. Retry the failed step.';
const isActive = (r: Run): boolean => r.status !== 'done' && r.status !== 'failed';

export function memoryStore(): Store {
  const runs = new Map<string, Run>();
  const posts = new Map<string, Post>();
  const transcripts = new Map<string, Transcript>();
  const analyses = new Map<string, Analysis>();
  const events = new Map<string, RunEvent[]>();
  const starts: { ipHash: string; at: number }[] = [];

  const postsOf = (runId: string): Post[] =>
    [...posts.values()].filter((p) => p.runId === runId);

  return {
    async createRun(r: NewRun) {
      if ([...runs.values()].some(isActive)) throw new ActiveRunExistsError();
      const now = new Date().toISOString();
      const run: Run = {
        id: crypto.randomUUID(),
        niche: r.niche,
        clientHandle: r.clientHandle,
        competitorHandles: [...r.competitorHandles],
        status: 'fetching',
        failedStep: null,
        error: null,
        skipped: [],
        videosFound: {},
        remaining: 0,
        apifyRunId: null,
        createdAt: now,
        startedAt: now,
      };
      runs.set(run.id, run);
      return { ...run };
    },
    async getRun(id) {
      const r = runs.get(id);
      return r ? { ...r } : null;
    },
    async listRuns() {
      // Map keeps insertion order, so reversing gives newest first even within one millisecond.
      return [...runs.values()]
        .reverse()
        .map((r) => ({ ...r, postCount: postsOf(r.id).length }));
    },
    async activeRun() {
      const r = [...runs.values()].reverse().find(isActive);
      return r ? { ...r } : null;
    },
    async failStaleRuns(beforeIso) {
      let n = 0;
      for (const [id, r] of runs) {
        if (!isActive(r) || r.startedAt >= beforeIso) continue;
        runs.set(id, { ...r, status: 'failed', failedStep: STALE_STEP[r.status], error: STALE_ERROR });
        n += 1;
      }
      return n;
    },
    async updateRun(id, patch) {
      const r = runs.get(id);
      if (r) runs.set(id, { ...r, ...patch, id });
    },
    async transitionRun(id, from: RunStatus, patch) {
      const r = runs.get(id);
      if (!r || r.status !== from) return false;
      runs.set(id, { ...r, ...patch, id });
      return true;
    },
    async replacePosts(runId, rows: NewPost[]) {
      for (const p of postsOf(runId)) posts.delete(p.id);
      return rows.map((row) => {
        const p: Post = { ...row, id: crypto.randomUUID(), runId };
        posts.set(p.id, p);
        return { ...p };
      });
    },
    async listPosts(runId) {
      return postsOf(runId).map((p) => ({ ...p }));
    },
    async getPost(id) {
      const p = posts.get(id);
      return p ? { ...p } : null;
    },
    async saveTranscriptOnce(t) {
      if (transcripts.has(t.postId)) return false;
      transcripts.set(t.postId, t);
      return true;
    },
    async listTranscripts(runId) {
      const ids = new Set(postsOf(runId).map((p) => p.id));
      return [...transcripts.values()].filter((t) => ids.has(t.postId));
    },
    async decrementRemaining(runId) {
      // Synchronous read-modify-write: no await, so concurrent callers never interleave.
      const r = runs.get(runId);
      if (!r) throw new Error(`Run not found: ${runId}`);
      const remaining = r.remaining - 1;
      runs.set(runId, { ...r, remaining });
      return remaining;
    },
    async saveAnalysis(a) {
      analyses.set(a.runId, a);
    },
    async getAnalysis(runId) {
      return analyses.get(runId) ?? null;
    },
    async addEvent(runId, message) {
      const list = events.get(runId) ?? [];
      list.push({ at: new Date().toISOString(), message });
      events.set(runId, list);
    },
    async listEvents(runId) {
      return [...(events.get(runId) ?? [])];
    },
    async countRecentStarts(ipHash, sinceIso) {
      const since = Date.parse(sinceIso);
      return starts.filter((s) => s.ipHash === ipHash && s.at >= since).length;
    },
    async recordStart(ipHash) {
      starts.push({ ipHash, at: Date.now() });
    },
  };
}
