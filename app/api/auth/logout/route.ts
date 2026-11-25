import { cookies } from 'next/headers';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(): Promise<Response> {
  (await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return Response.json({ ok: true });
}
