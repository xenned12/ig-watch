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
    for (const k of ['VERCEL_AUTOMATION_BYPASS_SECRET', 'SCRAPER', 'INSTALOADER_USERNAME', 'INSTALOADER_PYTHON']) vi.stubEnv(k, '');
    expect(serverEnv()).toEqual({
      ...values,
      VERCEL_AUTOMATION_BYPASS_SECRET: undefined,
      SCRAPER: 'apify',
      INSTALOADER_USERNAME: undefined,
      INSTALOADER_PYTHON: undefined,
    });
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'h');
    expect(serverEnv().VERCEL_AUTOMATION_BYPASS_SECRET).toBe('h');
  });

  it('with SCRAPER=instaloader the Apify token is optional', () => {
    const values = { OPENAI_API_KEY: 'b', OPENAI_MODEL: 'c', SUPABASE_SERVICE_ROLE_KEY: 'd', WEBHOOK_SECRET: 'e', NEXT_PUBLIC_SUPABASE_URL: 'f', NEXT_PUBLIC_APP_URL: 'g' };
    for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
    vi.stubEnv('APIFY_TOKEN', '');
    vi.stubEnv('SCRAPER', 'instaloader');
    vi.stubEnv('INSTALOADER_USERNAME', 'me_scraper');
    expect(serverEnv()).toMatchObject({ SCRAPER: 'instaloader', APIFY_TOKEN: undefined, INSTALOADER_USERNAME: 'me_scraper' });
  });

  it('rejects an unknown SCRAPER value', () => {
    vi.stubEnv('SCRAPER', 'selenium');
    expect(() => serverEnv()).toThrow('Unsupported SCRAPER: use apify or instaloader');
  });
});
