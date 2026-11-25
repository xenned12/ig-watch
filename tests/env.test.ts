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
      SUPABASE_SERVICE_ROLE_KEY: 'd',
      WEBHOOK_SECRET: 'e',
      NEXT_PUBLIC_SUPABASE_URL: 'f',
      NEXT_PUBLIC_APP_URL: 'g',
    };
    for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
    for (const k of ['AI_MODEL', 'VERCEL_AUTOMATION_BYPASS_SECRET', 'SCRAPER', 'INSTALOADER_USERNAME', 'INSTALOADER_PYTHON']) vi.stubEnv(k, '');
    expect(serverEnv()).toEqual({
      ...values,
      AI_MODEL: undefined,
      VERCEL_AUTOMATION_BYPASS_SECRET: undefined,
      SCRAPER: 'apify',
      INSTALOADER_USERNAME: undefined,
      INSTALOADER_PYTHON: undefined,
    });
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'h');
    expect(serverEnv().VERCEL_AUTOMATION_BYPASS_SECRET).toBe('h');
  });

  it('needs the Apify token even with SCRAPER=instaloader (transcription and AI use it)', () => {
    const values = { SUPABASE_SERVICE_ROLE_KEY: 'd', WEBHOOK_SECRET: 'e', NEXT_PUBLIC_SUPABASE_URL: 'f', NEXT_PUBLIC_APP_URL: 'g' };
    for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
    vi.stubEnv('APIFY_TOKEN', '');
    vi.stubEnv('SCRAPER', 'instaloader');
    expect(() => serverEnv()).toThrow('Missing server configuration: APIFY_TOKEN');
  });

  it('rejects an unknown SCRAPER value', () => {
    vi.stubEnv('SCRAPER', 'selenium');
    expect(() => serverEnv()).toThrow('Unsupported SCRAPER: use apify or instaloader');
  });
});
