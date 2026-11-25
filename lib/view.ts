import type { Analysis, Pattern, Post, Run, Transcript } from '@/lib/types';

export type PostWithTranscript = Post & { transcript: Transcript | null };
export type AcctFilter = string;
export type SortKey = 'views' | 'new' | 'len';

export const metric = (p: Post): number => p.views ?? p.likes;

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const v = [...nums].sort((a, b) => a - b);
  return (v[Math.floor((v.length - 1) / 2)] + v[Math.ceil((v.length - 1) / 2)]) / 2;
}

const avgLen = (posts: Post[]) =>
  posts.length === 0 ? 0 : Math.round(posts.reduce((s, p) => s + p.durationS, 0) / posts.length);

export function kpis(posts: Post[], analysis: Analysis) {
  const comp = posts.filter((p) => !p.isClient);
  const client = posts.filter((p) => p.isClient);
  const compMedian = median(comp.map(metric));
  const clientMedian = median(client.map(metric));
  const gapPct = compMedian === 0 ? 0 : Math.round((clientMedian / compMedian - 1) * 100);
  let topPattern: Pattern | null = null;
  for (const p of analysis.patterns) {
    if (!topPattern || p.competitorCount > topPattern.competitorCount) topPattern = p;
  }
  return { compMedian, clientMedian, gapPct, compAvgLen: avgLen(comp), clientAvgLen: avgLen(client), topPattern };
}

/** The text a post is searched and shown by: its transcript, else its caption. */
export const postText = (p: PostWithTranscript): string => p.transcript?.text ?? p.caption;

export function filterPosts<T extends PostWithTranscript>(
  posts: T[],
  opts: { acct: AcctFilter; q: string; sort: SortKey },
): T[] {
  const q = opts.q.trim().toLowerCase();
  const handleQ = q.replace(/^@/, '');
  const list = posts.filter(
    (p) =>
      (opts.acct === 'all' || (opts.acct === 'comp' && !p.isClient) || p.handle === opts.acct) &&
      (!q || postText(p).toLowerCase().includes(q) || p.handle.toLowerCase().includes(handleQ)),
  );
  return list.sort((a, b) =>
    opts.sort === 'views'
      ? metric(b) - metric(a)
      : opts.sort === 'new'
        ? Date.parse(b.postedAt) - Date.parse(a.postedAt)
        : b.durationS - a.durationS,
  );
}

const plural = (n: number) => (n === 1 ? '' : 's');

export function dataNotes(
  run: Pick<Run, 'clientHandle' | 'competitorHandles' | 'skipped'>,
  posts: PostWithTranscript[],
): string[] {
  const notes: string[] = [];
  for (const h of [run.clientHandle, ...run.competitorHandles]) {
    const own = posts.filter((p) => p.handle === h);
    const noViews = own.filter((p) => p.views == null).length;
    const noSpeech = own.filter((p) => p.transcript?.source === 'caption').length;
    if (noViews > 0) {
      notes.push(
        `@${h}: ${noViews} post${plural(noViews)} had no view count, so ${noViews === 1 ? 'it was' : 'they were'} ranked by likes.`,
      );
    }
    if (noSpeech > 0) {
      notes.push(`@${h}: ${noSpeech} post${plural(noSpeech)} had no speech, so the caption is used as the transcript.`);
    }
  }
  for (const s of run.skipped) notes.push(`@${s.handle} was skipped: ${s.reason}.`);
  return notes;
}

export function fmt(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

export function fmtDate(iso: string, withYear = false): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

export function fmtClock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
