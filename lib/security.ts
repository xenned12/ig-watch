import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

export function checkSecret(header: string | null, expected: string): boolean {
  if (header === null) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + serverEnv().WEBHOOK_SECRET).digest('hex');
}
