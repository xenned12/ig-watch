/** Paths reachable without a session. Machine callbacks check `x-webhook-secret` themselves. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/webhooks/apify' ||
    pathname.startsWith('/api/webhooks/apify/') ||
    pathname.startsWith('/api/jobs/')
  );
}
