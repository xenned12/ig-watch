import type { Niche } from '@/lib/handles';

export type RunStatus = 'fetching' | 'transcribing' | 'analyzing' | 'done' | 'failed';
export type Step = 'fetch' | 'transcribe' | 'analyze';

export type Run = {
  id: string;
  niche: Niche;
  clientHandle: string;
  competitorHandles: string[];
  status: RunStatus;
  failedStep: Step | null;
  error: string | null;
  skipped: { handle: string; reason: string }[];
  videosFound: Record<string, number>;
  remaining: number;
  apifyRunId: string | null;
  createdAt: string;
  startedAt: string;
};

export type Post = {
  id: string;
  runId: string;
  handle: string;
  isClient: boolean;
  igUrl: string;
  postedAt: string;
  views: number | null;
  likes: number;
  comments: number;
  durationS: number;
  rankMetric: 'views' | 'likes';
  rank: number;
  videoUrl: string | null;
  caption: string;
};

export type Transcript = {
  postId: string;
  text: string;
  segments: { startS: number; text: string }[];
  source: 'whisper' | 'caption';
};

export type Pattern = {
  name: string;
  competitorCount: number;
  clientCount: number;
  postIds: string[];
};
export type Gap = { text: string; kind: 'gap' | 'keep' };
export type Recommendation = { text: string; reason: string; postId: string };
export type Script = {
  name: string;
  lengthS: number;
  patterns: string[];
  hook: string;
  beats: { at: string; text: string }[];
  cta: string;
};

export type Analysis = {
  runId: string;
  patterns: Pattern[];
  gaps: Gap[];
  recommendations: Recommendation[];
  scripts: Script[];
};
