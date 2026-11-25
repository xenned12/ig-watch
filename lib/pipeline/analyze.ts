import { ZodError, type ZodType } from 'zod';
import type { Deps } from '@/lib/pipeline/deps';
import {
  COMPARE_SYSTEM,
  CompareOut,
  PATTERNS_SYSTEM,
  PatternsOut,
} from '@/lib/pipeline/analyze-prompts';
import { APIFY_OUT_OF_CREDITS, isApifyOutOfCredits } from '@/lib/pipeline/credits';
import type { Post, Transcript } from '@/lib/types';

const ANALYZE_FAILED = 'The analysis came back incomplete. Retry the failed step.';
const MAX_ATTEMPTS = 2;

function block(post: Post, transcripts: Map<string, Transcript>): string {
  const metric = post.rankMetric === 'views' ? (post.views ?? 0) : post.likes;
  const text = transcripts.get(post.id)?.text ?? post.caption;
  return `[post:${post.id}] @${post.handle} · ${metric} ${post.rankMetric} · ${post.durationS}s\n${text}`;
}

async function callWithRetry<T>(deps: Deps, schema: ZodType<T>, system: string, user: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // Re-parse after the call so .min/.max/.length are enforced even if the API ignores them.
      return schema.parse(await deps.ai.json(schema, system, user));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function fail(deps: Deps, runId: string, error: string): Promise<void> {
  // Conditional so a run the stale sweep or a retry already moved on is never overwritten.
  const moved = await deps.store.transitionRun(runId, 'analyzing', {
    status: 'failed',
    failedStep: 'analyze',
    error,
  });
  if (moved) await deps.progress.emit(runId, { step: 'failed', message: error });
}

export async function analyzeRun(deps: Deps, runId: string): Promise<void> {
  const { store, progress } = deps;
  const run = await store.getRun(runId);
  if (!run || run.status !== 'analyzing') return;

  try {
    const posts = await store.listPosts(runId);
    const transcripts = new Map((await store.listTranscripts(runId)).map((t) => [t.postId, t]));
    const competitors = posts.filter((p) => !p.isClient);
    const client = posts.filter((p) => p.isClient);
    const competitorIds = new Set(competitors.map((p) => p.id));

    const competitorBlocks = competitors.map((p) => block(p, transcripts)).join('\n\n');
    const patternsOut = await callWithRetry(
      deps,
      PatternsOut,
      PATTERNS_SYSTEM,
      `Niche: ${run.niche}\n\nCompetitor reels:\n${competitorBlocks}`,
    );

    const clientBlocks = client.map((p) => block(p, transcripts)).join('\n\n');
    const idList = competitors.map((p) => `${p.id} (@${p.handle})`).join('\n');
    const compareOut = await callWithRetry(
      deps,
      CompareOut,
      COMPARE_SYSTEM,
      `Competitor patterns:\n${JSON.stringify(patternsOut.patterns)}\n\nClient reels:\n${clientBlocks}\n\nCompetitor post ids:\n${idList}`,
    );

    const recommendations = compareOut.recommendations.filter((r) => competitorIds.has(r.postId));
    if (recommendations.length === 0) throw new Error('No valid recommendations');

    const counts = new Map(compareOut.clientCounts.map((c) => [c.name, c.clientCount]));
    const patterns = patternsOut.patterns.map((p) => ({
      name: p.name,
      competitorCount: p.competitorCount,
      clientCount: counts.get(p.name) ?? 0,
      postIds: p.postIds.filter((id) => competitorIds.has(id)),
    }));

    await store.saveAnalysis({
      runId,
      patterns,
      gaps: compareOut.gaps,
      recommendations,
      scripts: compareOut.scripts,
    });
    const moved = await store.transitionRun(runId, 'analyzing', { status: 'done' });
    if (moved) await progress.emit(runId, { step: 'done', message: '3 scripts ready' });
  } catch (err) {
    // Surface the cause in the server logs; the user only sees the generic message.
    const detail = err instanceof ZodError ? JSON.stringify(err.issues).slice(0, 2000) : String(err);
    console.error(`[analyze] run ${runId} failed: ${detail}`);
    await fail(deps, runId, isApifyOutOfCredits(err) ? APIFY_OUT_OF_CREDITS : ANALYZE_FAILED);
  }
}
