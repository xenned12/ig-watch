import 'server-only';
import { z } from 'zod';

const NAMES = [
  'APIFY_TOKEN', // scraping, transcription and the AI analysis all bill to Apify
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEBHOOK_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_APP_URL',
] as const;

/** Optional settings; an empty string counts as unset. */
const OPTIONAL = [
  'GEMINI_API_KEY', // when set, the analysis uses Google Gemini's free tier instead of Apify
  'AI_MODEL', // model id for the analysis; default gemini-flash-latest or openai/gpt-4.1-mini
  'VERCEL_AUTOMATION_BYPASS_SECRET', // only with Vercel Deployment Protection (see README)
  'INSTALOADER_USERNAME', // saved Instaloader session to use (SCRAPER=instaloader)
  'INSTALOADER_PYTHON', // Python with instaloader installed; default .venv/bin/python
] as const;

const SCRAPERS = ['apify', 'instaloader'] as const;
export type ScraperName = (typeof SCRAPERS)[number];

type Required = Record<(typeof NAMES)[number], string>;
type Optional = Record<(typeof OPTIONAL)[number], string | undefined>;
export type ServerEnv = Required & Optional & { SCRAPER: ScraperName };

const read = (k: string): string | undefined => {
  const v = process.env[k];
  return v === undefined || v === '' ? undefined : v;
};

export function serverEnv(): ServerEnv {
  const scraper = z.enum(SCRAPERS).safeParse(read('SCRAPER') ?? 'apify');
  if (!scraper.success) throw new Error('Unsupported SCRAPER: use apify or instaloader');

  const missing = NAMES.find((n) => read(n) === undefined);
  if (missing) throw new Error(`Missing server configuration: ${missing}`);

  const required = Object.fromEntries(NAMES.map((n) => [n, read(n)])) as Omit<ServerEnv, keyof Optional | 'SCRAPER'>;
  const optional = Object.fromEntries(OPTIONAL.map((n) => [n, read(n)])) as Optional;
  return { ...required, ...optional, SCRAPER: scraper.data };
}

const AUTH = ['APP_USERNAME', 'APP_PASSWORD', 'SESSION_SECRET', 'TURNSTILE_SECRET_KEY'] as const;
export type AuthEnv = Record<(typeof AUTH)[number], string>;

/** Login settings. Kept apart from serverEnv() so the proxy reads only what it needs. */
export function authEnv(): AuthEnv {
  const missing = AUTH.find((n) => read(n) === undefined);
  if (missing) throw new Error(`Missing server configuration: ${missing}`);
  if ((read('SESSION_SECRET') ?? '').length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return Object.fromEntries(AUTH.map((n) => [n, read(n)])) as AuthEnv;
}
