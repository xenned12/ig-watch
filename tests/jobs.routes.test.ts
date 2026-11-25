import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pending: (() => Promise<void> | void)[] = [];

vi.mock('next/server', () => ({
  after: (cb: () => Promise<void> | void) => {
    pending.push(cb);
  },
}));
vi.mock('@/lib/pipeline/deps', () => ({ makeDeps: vi.fn(() => ({})) }));
vi.mock('@/lib/pipeline/analyze', () => ({ analyzeRun: vi.fn() }));
vi.mock('@/lib/pipeline/transcribe', () => ({ transcribePost: vi.fn() }));

const { makeDeps } = await import('@/lib/pipeline/deps');
const { analyzeRun } = await import('@/lib/pipeline/analyze');
const { transcribePost } = await import('@/lib/pipeline/transcribe');
const analyzeRoute = await import('@/app/api/jobs/analyze/route');
const transcribeRoute = await import('@/app/api/jobs/transcribe/route');

const SECRET = 'test-secret';
const ID = '00000000-0000-4000-8000-000000000001';

function req(body: unknown, secret = SECRET): Request {
  return new Request('http://localhost/api/jobs/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': secret },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  pending.length = 0;
  for (const n of ['APIFY_TOKEN', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_APP_URL']) {
    vi.stubEnv(n, 'x');
  }
  vi.stubEnv('WEBHOOK_SECRET', SECRET);
  vi.mocked(makeDeps).mockReset().mockReturnValue({} as ReturnType<typeof makeDeps>);
  vi.mocked(analyzeRun).mockReset();
  vi.mocked(transcribePost).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('job routes dispatch work after responding', () => {
  it('analyze returns 202 without waiting for the analysis', async () => {
    vi.mocked(analyzeRun).mockReturnValue(new Promise(() => {}));
    const res = await analyzeRoute.POST(req({ runId: ID }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(analyzeRun).not.toHaveBeenCalled();
    expect(pending).toHaveLength(1);
    void pending[0]?.();
    expect(analyzeRun).toHaveBeenCalledWith({}, ID);
  });

  it('transcribe returns 202 and runs the transcription in after()', async () => {
    const res = await transcribeRoute.POST(req({ postId: ID }));
    expect(res.status).toBe(202);
    expect(transcribePost).not.toHaveBeenCalled();
    await pending[0]?.();
    expect(transcribePost).toHaveBeenCalledWith({}, ID);
  });

  it('rejects a wrong secret with 401 and a bad body with 400, scheduling nothing', async () => {
    expect((await analyzeRoute.POST(req({ runId: ID }, 'nope'))).status).toBe(401);
    expect((await transcribeRoute.POST(req({ postId: 'bad' }))).status).toBe(400);
    expect(pending).toHaveLength(0);
  });

  it('background callbacks never throw, even when makeDeps or the job throws', async () => {
    await analyzeRoute.POST(req({ runId: ID }));
    await transcribeRoute.POST(req({ postId: ID }));
    vi.mocked(makeDeps).mockImplementation(() => {
      throw new Error('Missing server configuration');
    });
    await expect(Promise.resolve(pending[0]?.())).resolves.toBeUndefined();
    vi.mocked(makeDeps).mockReturnValue({} as ReturnType<typeof makeDeps>);
    vi.mocked(transcribePost).mockRejectedValue(new Error('db down'));
    await expect(Promise.resolve(pending[1]?.())).resolves.toBeUndefined();
  });

  it('declares the function budgets', () => {
    expect(transcribeRoute.maxDuration).toBe(60);
    expect(analyzeRoute.maxDuration).toBe(300);
  });
});
