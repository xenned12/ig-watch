import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS, SESSION_COOKIE } from '@/lib/auth/session';
import { checkCredentials } from '@/lib/auth/credentials';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { isPublicPath } from '@/lib/auth/gate';
import { proxy } from '@/proxy';

const SECRET = 'x'.repeat(40);

describe('session token', () => {
  it('verifies a fresh token', () => {
    expect(verifySessionToken(createSessionToken(SECRET), SECRET)).toBe(true);
  });
  it('rejects another secret, tampering, expiry and junk', () => {
    const t = createSessionToken(SECRET);
    expect(verifySessionToken(t, 'y'.repeat(40))).toBe(false);
    expect(verifySessionToken(`9${t}`, SECRET)).toBe(false);
    expect(verifySessionToken(t, SECRET, Date.now() + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
    expect(verifySessionToken(undefined, SECRET)).toBe(false);
    expect(verifySessionToken('a.b.c', SECRET)).toBe(false);
  });
});

describe('checkCredentials', () => {
  const exp = { username: 'admin', password: 'hunter2' };
  it('accepts only the exact pair', () => {
    expect(checkCredentials(exp, exp)).toBe(true);
    expect(checkCredentials({ ...exp, password: 'hunter3' }, exp)).toBe(false);
    expect(checkCredentials({ ...exp, username: 'root' }, exp)).toBe(false);
  });
});

describe('verifyTurnstile', () => {
  const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);
  it('passes on success and sends secret + token', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('tok', 'sec', '1.2.3.4', f)).toBe(true);
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get('secret')).toBe('sec');
    expect(body.get('response')).toBe('tok');
  });
  it('fails on rejection, HTTP error or network error', async () => {
    expect(await verifyTurnstile('t', 's', undefined, reply({ success: false }))).toBe(false);
    expect(await verifyTurnstile('t', 's', undefined, reply({}, false))).toBe(false);
    expect(await verifyTurnstile('t', 's', undefined, vi.fn(async () => { throw new Error('x'); }))).toBe(false);
  });
});

describe('isPublicPath', () => {
  it('opens only login and machine callbacks', () => {
    for (const p of ['/login', '/api/auth/login', '/api/webhooks/apify', '/api/jobs/analyze']) expect(isPublicPath(p)).toBe(true);
    for (const p of ['/', '/runs', '/api/runs', '/api/auth/logout', '/api/jobsx', '/login/x']) expect(isPublicPath(p)).toBe(false);
  });
});

describe('proxy', () => {
  const env = () => {
    vi.stubEnv('APP_USERNAME', 'admin'); vi.stubEnv('APP_PASSWORD', 'pw');
    vi.stubEnv('SESSION_SECRET', SECRET); vi.stubEnv('TURNSTILE_SECRET_KEY', 'ts');
  };
  afterEach(() => vi.unstubAllEnvs());
  const req = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } } : undefined);

  it('redirects pages and 401s APIs without a session', async () => {
    env();
    const page = proxy(req('/runs'));
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toBe('http://localhost/login');
    expect(proxy(req('/api/runs')).status).toBe(401);
  });
  it('lets a valid session and public paths through', () => {
    env();
    expect(proxy(req('/runs', createSessionToken(SECRET))).headers.get('x-middleware-next')).toBe('1');
    expect(proxy(req('/api/jobs/analyze')).headers.get('x-middleware-next')).toBe('1');
  });
  it('stays locked when config is missing', () => {
    expect(proxy(req('/api/runs', createSessionToken(SECRET))).status).toBe(401);
  });
});
