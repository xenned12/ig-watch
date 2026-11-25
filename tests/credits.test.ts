import { describe, expect, it } from 'vitest';
import { isApifyOutOfCredits } from '@/lib/pipeline/credits';

describe('isApifyOutOfCredits', () => {
  it('matches usage-limit refusals', () => {
    expect(isApifyOutOfCredits({ statusCode: 403, type: 'not-enough-usage-to-run-paid-actor' })).toBe(true);
    expect(isApifyOutOfCredits({ statusCode: 403, message: 'Monthly usage hard limit exceeded' })).toBe(true);
    expect(isApifyOutOfCredits({ statusCode: 402 })).toBe(true);
    expect(isApifyOutOfCredits({ status: 402, message: 'Insufficient credits' })).toBe(true);
  });
  it('ignores other failures', () => {
    expect(isApifyOutOfCredits({ statusCode: 404, message: 'Actor not found' })).toBe(false);
    expect(isApifyOutOfCredits(new Error('network down'))).toBe(false);
  });
});
