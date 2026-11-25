import { ApifyItemSchema, type ApifyItem } from '@/lib/apify/schema';
import { normaliseHandle } from '@/lib/handles';
import type { Post } from '@/lib/types';

type RankedPost = Omit<Post, 'id' | 'runId'>;
type Skipped = { handle: string; reason: string };
type RankResult = {
  posts: RankedPost[];
  videosFound: Record<string, number>;
  skipped: Skipped[];
};

const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const TOP_N = 10;
const NOT_FOUND = 'Account not found or private';
const NO_VIDEOS = 'No video posts in the last 90 days';
const BLOCKED = 'Instagram blocked the request. Sign in to Instaloader or try again later';
// Error codes the Instaloader script uses when Instagram refuses the request.
const BLOCKED_CODES = new Set(['login_required', 'fetch_failed']);

function itemHandle(item: ApifyItem): string | null {
  if (item.ownerUsername) return normaliseHandle(item.ownerUsername);
  if (item.inputUrl) return normaliseHandle(item.inputUrl);
  return null;
}

function isVideo(item: ApifyItem): boolean {
  return item.type === 'Video' || item.productType === 'clips';
}

function inWindow(item: ApifyItem, now: Date): boolean {
  if (!item.timestamp) return false;
  const t = Date.parse(item.timestamp);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime() && now.getTime() - t <= WINDOW_MS;
}

function sortKey(item: ApifyItem): number {
  return item.videoViewCount ?? item.videoPlayCount ?? item.likesCount ?? 0;
}

function byRank(a: ApifyItem, b: ApifyItem): number {
  return sortKey(b) - sortKey(a) || Date.parse(b.timestamp ?? '') - Date.parse(a.timestamp ?? '');
}

function toPost(item: ApifyItem, handle: string, isClient: boolean, rank: number): RankedPost {
  const views = item.videoViewCount ?? item.videoPlayCount ?? null;
  return {
    handle,
    isClient,
    igUrl: item.url ?? '',
    postedAt: new Date(item.timestamp ?? '').toISOString(),
    views,
    likes: item.likesCount ?? 0,
    comments: item.commentsCount ?? 0,
    durationS: Math.round(item.videoDuration ?? 0),
    rankMetric: views === null ? 'likes' : 'views',
    rank,
    videoUrl: item.videoUrl ?? null,
    caption: item.caption ?? '',
  };
}

export function rankItems(
  items: unknown[],
  handles: { client: string; competitors: string[] },
  now: Date,
): RankResult {
  const client = normaliseHandle(handles.client);
  const order = [client, ...handles.competitors.map(normaliseHandle)];
  const videos = new Map<string, ApifyItem[]>();
  const errored = new Map<string, string>(); // handle → skip reason
  for (const h of order) videos.set(h, []);

  for (const raw of items) {
    const parsed = ApifyItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const handle = itemHandle(item);
    if (handle === null || !videos.has(handle)) continue;
    if (item.error) errored.set(handle, BLOCKED_CODES.has(item.error) ? BLOCKED : NOT_FOUND);
    if (isVideo(item) && inWindow(item, now)) videos.get(handle)?.push(item);
  }

  const posts: RankedPost[] = [];
  const videosFound: Record<string, number> = {};
  const skipped: Skipped[] = [];
  for (const handle of new Set(order)) {
    const found = videos.get(handle) ?? [];
    videosFound[handle] = found.length;
    if (found.length === 0) {
      skipped.push({ handle, reason: errored.get(handle) ?? NO_VIDEOS });
      continue;
    }
    found
      .sort(byRank)
      .slice(0, TOP_N)
      .forEach((item, i) => posts.push(toPost(item, handle, handle === client, i + 1)));
  }
  return { posts, videosFound, skipped };
}
