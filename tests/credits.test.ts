import { describe, expect, it } from 'vitest';
import { isApifyOutOfCredits, isOpenAIOutOfCredits } from '@/lib/pipeline/credits';

describe('isOpenAIOutOfCredits', () => {
  it('matches an empty balance', () => {
    expect(isOpenAIOutOfCredits({ status: 429, message: '429 You have no credits remaining.' })).toBe(true);
    expect(isOpenAIOutOfCredits({ status: 429, code: 'insufficient_quota' })).toBe(true);
  });
  it('ignores plain rate limits and other errors', () => {
    expect(isOpenAIOutOfCredits({ status: 429, code: 'rate_limit_exceeded', message: 'Rate limit reached' })).toBe(false);
    expect(isOpenAIOutOfCredits({ status: 500, message: 'no credits' })).toBe(false);
    expect(isOpenAIOutOfCredits(new Error('boom'))).toBe(false);
  });
});

describe('isApifyOutOfCredits', () => {
  it('matches usage-limit refusals', () => {
    expect(isApifyOutOfCredits({ statusCode: 403, type: 'not-enough-usage-to-run-paid-actor' })).toBe(true);
    expect(isApifyOutOfCredits({ statusCode: 403, message: 'Monthly usage hard limit exceeded' })).toBe(true);
    expect(isApifyOutOfCredits({ statusCode: 402 })).toBe(true);
  });
  it('ignores other failures', () => {
    expect(isApifyOutOfCredits({ statusCode: 404, message: 'Actor not found' })).toBe(false);
    expect(isApifyOutOfCredits(new Error('network down'))).toBe(false);
  });
});
