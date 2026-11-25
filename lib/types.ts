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
// One timed section of a full script: the exact words spoken, the text overlay
// (empty when none) and a short filming direction.
export type ScriptBeat = { at: string; voiceover: string; onScreen: string; direction: string };
// Scripts saved before full scripts existed only have a one-line summary per beat.
export type LegacyBeat = { at: string; text: string };

export type Script = {
  name: string;
  lengthS: number;
  patterns: string[];
  hook: string;
  beats: (ScriptBeat | LegacyBeat)[];
  cta: string;
};

export type Analysis = {
  runId: string;
  patterns: Pattern[];
  gaps: Gap[];
  recommendations: Recommendation[];
  scripts: Script[];
};
