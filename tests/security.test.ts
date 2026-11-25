import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSecret, hashIp } from '@/lib/security';

describe('checkSecret', () => {
  it('accepts a matching secret', () => {
    expect(checkSecret('abc', 'abc')).toBe(true);
  });
  it('rejects a different secret of equal length', () => {
    expect(checkSecret('abd', 'abc')).toBe(false);
  });
  it('rejects a different length', () => {
    expect(checkSecret('ab', 'abc')).toBe(false);
  });
  it('rejects a null header', () => {
    expect(checkSecret(null, 'abc')).toBe(false);
  });
});

describe('hashIp', () => {
  beforeEach(() => {
    for (const n of [
      'APIFY_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY',
      'WEBHOOK_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_APP_URL',
    ]) vi.stubEnv(n, `test-${n}`);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is deterministic and not the raw ip', () => {
    const a = hashIp('1.2.3.4');
    expect(hashIp('1.2.3.4')).toBe(a);
    expect(a).not.toBe('1.2.3.4');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
