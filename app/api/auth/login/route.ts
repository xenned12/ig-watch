import { z } from 'zod';
import { authEnv } from '@/lib/env';
import { checkCredentials } from '@/lib/auth/credentials';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { cookies } from 'next/headers';

const Body = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
  turnstileToken: z.string().min(1).max(4096),
});

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('Enter your username, password and finish the captcha.', 400);
    const env = authEnv();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
    if (!(await verifyTurnstile(parsed.data.turnstileToken, env.TURNSTILE_SECRET_KEY, ip))) {
      return fail('Captcha check failed. Try again.', 400);
    }
    const ok = checkCredentials(parsed.data, { username: env.APP_USERNAME, password: env.APP_PASSWORD });
    if (!ok) return fail('Wrong username or password.', 401);
    (await cookies()).set(SESSION_COOKIE, createSessionToken(env.SESSION_SECRET), sessionCookieOptions());
    return Response.json({ ok: true });
  } catch {
    return fail('Something went wrong. Try again.', 500);
  }
}
