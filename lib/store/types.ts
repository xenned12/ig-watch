import type { Niche } from '@/lib/handles';
import type { Analysis, NicheAccounts, Post, Run, RunStatus, TopAccount, Transcript } from '@/lib/types';

export type NewRun = { niche: Niche; clientHandle: string; competitorHandles: string[] };
export type NewPost = Omit<Post, 'id' | 'runId'>;
export type RunEvent = { at: string; message: string };

export class ActiveRunExistsError extends Error {
  constructor() {
    super('Another run is already active');
    this.name = 'ActiveRunExistsError';
  }
}

export interface Store {
  createRun(r: NewRun): Promise<Run>;
  getRun(id: string): Promise<Run | null>;
  listRuns(): Promise<(Run & { postCount: number })[]>;
  activeRun(): Promise<Run | null>;
  failStaleRuns(beforeIso: string): Promise<number>;
  updateRun(id: string, patch: Partial<Run>): Promise<void>;
  transitionRun(id: string, from: RunStatus, patch: Partial<Run>): Promise<boolean>;
  replacePosts(runId: string, posts: NewPost[]): Promise<Post[]>;
  listPosts(runId: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  saveTranscriptOnce(t: Transcript): Promise<boolean>;
  listTranscripts(runId: string): Promise<Transcript[]>;
  decrementRemaining(runId: string): Promise<number>;
  saveAnalysis(a: Analysis): Promise<void>;
  getAnalysis(runId: string): Promise<Analysis | null>;
  addEvent(runId: string, message: string): Promise<void>;
  listEvents(runId: string): Promise<RunEvent[]>;
  countRecentStarts(ipHash: string, sinceIso: string): Promise<number>;
  recordStart(ipHash: string): Promise<void>;
  /** Cached top accounts per preset niche, keyed by the lower-case niche. */
  getNicheAccounts(nicheKey: string): Promise<NicheAccounts | null>;
  /** Saves a finished search's accounts and clears the running search. */
  saveNicheAccounts(nicheKey: string, accounts: TopAccount[], fetchedAt: string): Promise<void>;
  /** Records (or clears, with null) the account search running for a niche. */
  setNichePending(nicheKey: string, runId: string | null, sinceIso: string | null): Promise<void>;
}
