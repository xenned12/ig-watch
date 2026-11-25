import 'server-only';
import { z } from 'zod';

const NAMES = [
  'APIFY_TOKEN',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEBHOOK_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_APP_URL',
] as const;

/** Optional settings; an empty string counts as unset. */
const OPTIONAL = [
  'VERCEL_AUTOMATION_BYPASS_SECRET', // only with Vercel Deployment Protection (see README)
  'INSTALOADER_USERNAME', // saved Instaloader session to use (SCRAPER=instaloader)
  'INSTALOADER_PYTHON', // Python with instaloader installed; default .venv/bin/python
] as const;

const SCRAPERS = ['apify', 'instaloader'] as const;
export type ScraperName = (typeof SCRAPERS)[number];

type Required = Record<(typeof NAMES)[number], string>;
type Optional = Record<(typeof OPTIONAL)[number], string | undefined>;
export type ServerEnv = Omit<Required, 'APIFY_TOKEN'> &
  Optional & { APIFY_TOKEN: string | undefined; SCRAPER: ScraperName };

const read = (k: string): string | undefined => {
  const v = process.env[k];
  return v === undefined || v === '' ? undefined : v;
};

export function serverEnv(): ServerEnv {
  const scraper = z.enum(SCRAPERS).safeParse(read('SCRAPER') ?? 'apify');
  if (!scraper.success) throw new Error('Unsupported SCRAPER: use apify or instaloader');

  // The Apify token is only needed when Apify is the scraper.
  const needed = NAMES.filter((n) => n !== 'APIFY_TOKEN' || scraper.data === 'apify');
  const missing = needed.find((n) => read(n) === undefined);
  if (missing) throw new Error(`Missing server configuration: ${missing}`);

  const required = Object.fromEntries(NAMES.map((n) => [n, read(n)])) as Omit<ServerEnv, keyof Optional | 'SCRAPER'>;
  const optional = Object.fromEntries(OPTIONAL.map((n) => [n, read(n)])) as Optional;
  return { ...required, ...optional, SCRAPER: scraper.data };
}
