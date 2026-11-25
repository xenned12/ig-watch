import { z } from 'zod';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const Result = z.object({ success: z.boolean() });

/** Server-side check of a Cloudflare Turnstile token. Any failure counts as "not verified". */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const res = await fetchFn(SITEVERIFY, { method: 'POST', body: form });
    if (!res.ok) return false;
    const parsed = Result.safeParse(await res.json());
    return parsed.success && parsed.data.success;
  } catch {
    return false;
  }
}
