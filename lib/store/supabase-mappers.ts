import type { Niche } from '@/lib/handles';
import type { Analysis, Post, Run, Transcript } from '@/lib/types';
import type { NewPost } from '@/lib/store/types';

// One mapper pair per table: snake_case rows <-> camelCase domain types.
// Rows come from PostgREST as untyped JSON, so they are typed loosely here and
// the cast is confined to these functions.
export type Row = Record<string, unknown>;

export function runFromRow(r: Row): Run {
  return {
    id: r.id as string,
    niche: r.niche as Niche,
    clientHandle: r.client_handle as string,
    competitorHandles: r.competitor_handles as string[],
    status: r.status as Run['status'],
    failedStep: (r.failed_step as Run['failedStep']) ?? null,
    error: (r.error as string | null) ?? null,
    skipped: r.skipped as Run['skipped'],
    videosFound: r.videos_found as Run['videosFound'],
    remaining: r.remaining as number,
    apifyRunId: (r.apify_run_id as string | null) ?? null,
    createdAt: r.created_at as string,
    startedAt: r.started_at as string,
  };
}

export function runPatchToRow(p: Partial<Run>): Row {
  const map: Record<keyof Run, string> = {
    id: 'id',
    niche: 'niche',
    clientHandle: 'client_handle',
    competitorHandles: 'competitor_handles',
    status: 'status',
    failedStep: 'failed_step',
    error: 'error',
    skipped: 'skipped',
    videosFound: 'videos_found',
    remaining: 'remaining',
    apifyRunId: 'apify_run_id',
    createdAt: 'created_at',
    startedAt: 'started_at',
  };
  const row: Row = {};
  for (const key of Object.keys(p) as (keyof Run)[]) {
    if (key !== 'id' && p[key] !== undefined) row[map[key]] = p[key];
  }
  return row;
}

export function postFromRow(r: Row): Post {
  return {
    id: r.id as string,
    runId: r.run_id as string,
    handle: r.handle as string,
    isClient: r.is_client as boolean,
    igUrl: r.ig_url as string,
    postedAt: r.posted_at as string,
    views: (r.views as number | null) ?? null,
    likes: r.likes as number,
    comments: r.comments as number,
    durationS: r.duration_s as number,
    rankMetric: r.rank_metric as Post['rankMetric'],
    rank: r.rank as number,
    videoUrl: (r.video_url as string | null) ?? null,
    caption: r.caption as string,
  };
}

export function postToRow(runId: string, p: NewPost): Row {
  return {
    run_id: runId,
    handle: p.handle,
    is_client: p.isClient,
    ig_url: p.igUrl,
    posted_at: p.postedAt,
    views: p.views,
    likes: p.likes,
    comments: p.comments,
    duration_s: p.durationS,
    rank_metric: p.rankMetric,
    rank: p.rank,
    video_url: p.videoUrl,
    caption: p.caption,
  };
}

export function transcriptFromRow(r: Row): Transcript {
  return {
    postId: r.post_id as string,
    text: r.text as string,
    segments: r.segments as Transcript['segments'],
    source: r.source as Transcript['source'],
  };
}

export function transcriptToRow(t: Transcript): Row {
  return { post_id: t.postId, text: t.text, segments: t.segments, source: t.source };
}

export function analysisFromRow(r: Row): Analysis {
  return {
    runId: r.run_id as string,
    patterns: r.patterns as Analysis['patterns'],
    gaps: r.gaps as Analysis['gaps'],
    recommendations: r.recommendations as Analysis['recommendations'],
    scripts: r.scripts as Analysis['scripts'],
  };
}

export function analysisToRow(a: Analysis): Row {
  return {
    run_id: a.runId,
    patterns: a.patterns,
    gaps: a.gaps,
    recommendations: a.recommendations,
    scripts: a.scripts,
  };
}
