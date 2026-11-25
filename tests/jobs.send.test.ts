import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendJob } from '@/lib/jobs';

const fetchMock = vi.fn();

beforeEach(() => {
  for (const n of ['APIFY_TOKEN', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) {
    vi.stubEnv(n, 'x');
  }
  vi.stubEnv('WEBHOOK_SECRET', 'sek');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function sentInit(): RequestInit & { headers: Record<string, string> } {
  return fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> };
}

describe('sendJob', () => {
  it('posts with the secret, a short timeout and no bypass header by default', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', '');
    await sendJob('/api/jobs/analyze', { runId: 'r' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://app.example/api/jobs/analyze');
    expect(sentInit().headers['x-webhook-secret']).toBe('sek');
    expect('x-vercel-protection-bypass' in sentInit().headers).toBe(false);
    expect(spy).toHaveBeenCalledWith(10_000);
    spy.mockRestore();
  });

  it('adds the Vercel protection bypass header when configured', async () => {
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'bypass');
    await sendJob('/api/jobs/transcribe', { postId: 'p' });
    expect(sentInit().headers['x-vercel-protection-bypass']).toBe('bypass');
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(sendJob('/api/jobs/analyze', { runId: 'r' })).rejects.toThrow('Job request failed: 500');
  });
});
