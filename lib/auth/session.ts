import { createHmac, timingSafeEqual } from 'node:crypto';

/** Name of the httpOnly cookie that carries the signed session. */
export const SESSION_COOKIE = 'ri_session';
/** Sessions last 7 days. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/** Token format: `<expiry unix seconds>.<HMAC-SHA256 of the expiry>`. */
export function createSessionToken(secret: string, now = Date.now()): string {
  const exp = String(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
  return `${exp}.${sign(exp, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, mac, extra] = token.split('.');
  if (!exp || !mac || extra !== undefined || !/^\d+$/.test(exp)) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(exp, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(exp) * 1000 > now;
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  };
}
