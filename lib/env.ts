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

const schema = z.object(
  Object.fromEntries(NAMES.map((n) => [n, z.string().min(1)])) as Record<
    (typeof NAMES)[number],
    z.ZodString
  >,
);

export type ServerEnv = z.infer<typeof schema>;

export function serverEnv(): ServerEnv {
  const result = schema.safeParse(
    Object.fromEntries(NAMES.map((n) => [n, process.env[n]])),
  );
  if (!result.success) {
    const missing = NAMES.find((n) =>
      result.error.issues.some((i) => i.path[0] === n),
    );
    throw new Error(`Missing server configuration: ${missing ?? 'unknown'}`);
  }
  return result.data;
}
