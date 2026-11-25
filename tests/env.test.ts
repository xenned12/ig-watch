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
    expect(serverEnv()).toEqual(values);
  });
});
