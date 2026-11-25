import { sweepStaleRuns } from '@/lib/pipeline/stale';
import type { Store } from '@/lib/store/types';
import type { Analysis, Post, Run, Transcript } from '@/lib/types';

export type RunListItem = Pick<
  Run,
  'id' | 'niche' | 'clientHandle' | 'competitorHandles' | 'status' | 'error' | 'createdAt'
> & { postCount: number };

export type RunDetail = {
  run: Omit<Run, 'apifyRunId' | 'startedAt'>;
  posts: (Post & { transcript: Transcript | null })[];
  analysis: Analysis | null;
  events: { at: string; message: string }[];
};

export async function runList(store: Store, now: Date = new Date()): Promise<RunListItem[]> {
  await sweepStaleRuns(store, now);
  const runs = await store.listRuns();
  return runs.map((r) => ({
    id: r.id,
    niche: r.niche,
    clientHandle: r.clientHandle,
    competitorHandles: r.competitorHandles,
    status: r.status,
    error: r.error,
    postCount: r.postCount,
    createdAt: r.createdAt,
  }));
}

export async function runDetail(
  store: Store,
  id: string,
  now: Date = new Date(),
): Promise<RunDetail | null> {
  await sweepStaleRuns(store, now);
  const r = await store.getRun(id);
  if (!r) return null;
  const [posts, transcripts, analysis, events] = await Promise.all([
    store.listPosts(id),
    store.listTranscripts(id),
    store.getAnalysis(id),
    store.listEvents(id),
  ]);
  const byPost = new Map(transcripts.map((t) => [t.postId, t]));
  const ordered = [...posts].sort((a, b) =>
    a.handle === b.handle ? a.rank - b.rank : a.handle < b.handle ? -1 : 1,
  );
  return {
    run: {
      id: r.id,
      niche: r.niche,
      clientHandle: r.clientHandle,
      competitorHandles: r.competitorHandles,
      status: r.status,
      failedStep: r.failedStep,
      error: r.error,
      skipped: r.skipped,
      videosFound: r.videosFound,
      remaining: r.remaining,
      createdAt: r.createdAt,
      rangeSince: r.rangeSince,
      rangeUntil: r.rangeUntil,
    },
    posts: ordered.map((p) => ({ ...p, transcript: byPost.get(p.id) ?? null })),
    analysis,
    events: events.map((e) => ({ at: e.at, message: e.message })),
  };
}
