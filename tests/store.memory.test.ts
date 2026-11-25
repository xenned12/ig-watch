import { describe, expect, it } from 'vitest';
import { memoryStore } from '@/lib/store/memory';
import { ActiveRunExistsError, type NewPost } from '@/lib/store/types';

const input = { niche: 'AI' as const, clientHandle: 'me', competitorHandles: ['a', 'b', 'c'] };
const post = (handle: string, rank: number): NewPost => ({
  handle, isClient: handle === 'me', igUrl: `https://instagram.com/p/${handle}${rank}`,
  postedAt: '2026-01-01T00:00:00.000Z', views: 100, likes: 10, comments: 1, durationS: 30,
  rankMetric: 'views', rank, videoUrl: null, caption: 'c',
});

describe('memoryStore', () => {
  it('saveTranscriptOnce is true only the first time', async () => {
    const s = memoryStore();
    const t = { postId: 'p1', text: 'x', segments: [], source: 'whisper' as const };
    expect(await s.saveTranscriptOnce(t)).toBe(true);
    expect(await s.saveTranscriptOnce(t)).toBe(false);
  });

  it('transitionRun only moves from the expected status', async () => {
    const s = memoryStore();
    const r = await s.createRun(input);
    expect(await s.transitionRun(r.id, 'fetching', { status: 'transcribing' })).toBe(true);
    expect(await s.transitionRun(r.id, 'fetching', { status: 'transcribing' })).toBe(false);
    expect((await s.getRun(r.id))?.status).toBe('transcribing');
  });

  it('createRun starts in fetching with defaults', async () => {
    const r = await memoryStore().createRun(input);
    expect(r).toMatchObject({ status: 'fetching', remaining: 0, failedStep: null, error: null, skipped: [] });
  });

  it('decrementRemaining gives each concurrent caller a distinct value', async () => {
    const s = memoryStore();
    const r = await s.createRun(input);
    await s.updateRun(r.id, { remaining: 5 });
    const out = await Promise.all([1, 2, 3, 4, 5].map(() => s.decrementRemaining(r.id)));
    expect([...out].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('activeRun ignores done and failed runs', async () => {
    const s = memoryStore();
    const a = await s.createRun(input);
    await s.updateRun(a.id, { status: 'done' });
    const b = await s.createRun(input);
    await s.updateRun(b.id, { status: 'failed' });
    expect(await s.activeRun()).toBeNull();
    const c = await s.createRun(input);
    expect((await s.activeRun())?.id).toBe(c.id);
  });

  it('countRecentStarts only counts starts inside the window for that ip', async () => {
    const s = memoryStore();
    await s.recordStart('ip1');
    await s.recordStart('ip1');
    await s.recordStart('ip2');
    const past = new Date(Date.now() - 3600_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(await s.countRecentStarts('ip1', past)).toBe(2);
    expect(await s.countRecentStarts('ip1', future)).toBe(0);
  });

  it('replacePosts replaces and listRuns reports postCount newest first', async () => {
    const s = memoryStore();
    const a = await s.createRun(input);
    await s.updateRun(a.id, { status: 'done' });
    const b = await s.createRun(input);
    await s.replacePosts(a.id, [post('a', 1), post('b', 2)]);
    const saved = await s.replacePosts(a.id, [post('a', 1)]);
    expect(saved).toHaveLength(1);
    expect(await s.listPosts(a.id)).toHaveLength(1);
    expect((await s.getPost(saved[0].id))?.runId).toBe(a.id);
    const runs = await s.listRuns();
    expect(runs.map((r) => [r.id, r.postCount])).toEqual([[b.id, 0], [a.id, 1]]);
  });

  it('saves analysis as an upsert and records events in order', async () => {
    const s = memoryStore();
    const r = await s.createRun(input);
    const base = { runId: r.id, patterns: [], gaps: [], recommendations: [], scripts: [] };
    await s.saveAnalysis(base);
    await s.saveAnalysis({ ...base, gaps: [{ text: 'g', kind: 'gap' }] });
    expect((await s.getAnalysis(r.id))?.gaps).toHaveLength(1);
    await s.addEvent(r.id, 'one');
    await s.addEvent(r.id, 'two');
    expect((await s.listEvents(r.id)).map((e) => e.message)).toEqual(['one', 'two']);
  });

  it('createRun throws ActiveRunExistsError while another run is active', async () => {
    const s = memoryStore();
    const a = await s.createRun(input);
    await expect(s.createRun(input)).rejects.toBeInstanceOf(ActiveRunExistsError);
    await s.updateRun(a.id, { status: 'done' });
    await expect(s.createRun(input)).resolves.toMatchObject({ status: 'fetching' });
  });
});
