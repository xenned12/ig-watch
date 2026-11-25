import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverEnv } from '@/lib/env';

describe('serverEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the first missing variable', () => {
    vi.stubEnv('APIFY_TOKEN', '');
    expect(() => serverEnv()).toThrow('Missing server configuration: APIFY_TOKEN');
  });

  it('returns all values when configured', () => {
    const values = {
      APIFY_TOKEN: 'a',
      OPENAI_API_KEY: 'b',
      OPENAI_MODEL: 'c',
      SUPABASE_SERVICE_ROLE_KEY: 'd',
      WEBHOOK_SECRET: 'e',
      NEXT_PUBLIC_SUPABASE_URL: 'f',
      NEXT_PUBLIC_APP_URL: 'g',
    };
    for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', '');
    expect(serverEnv()).toEqual({ ...values, VERCEL_AUTOMATION_BYPASS_SECRET: undefined });
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'h');
    expect(serverEnv().VERCEL_AUTOMATION_BYPASS_SECRET).toBe('h');
  });
});
