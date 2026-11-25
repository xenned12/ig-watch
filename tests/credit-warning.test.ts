import { describe, it, expect } from 'vitest';
import { creditWarning } from '@/lib/credit-warning';
import { APIFY_OUT_OF_CREDITS, OPENAI_OUT_OF_CREDITS } from '@/lib/pipeline/credits';

describe('creditWarning', () => {
  it('warns when the newest run failed for lack of credits', () => {
    expect(creditWarning([{ status: 'failed', error: OPENAI_OUT_OF_CREDITS }])).toBe(OPENAI_OUT_OF_CREDITS);
    expect(creditWarning([{ status: 'failed', error: APIFY_OUT_OF_CREDITS }])).toBe(APIFY_OUT_OF_CREDITS);
  });
  it('stays quiet for other failures, newer runs and no runs', () => {
    expect(creditWarning([{ status: 'failed', error: 'Something else' }])).toBeNull();
    expect(creditWarning([{ status: 'done', error: null }, { status: 'failed', error: OPENAI_OUT_OF_CREDITS }])).toBeNull();
    expect(creditWarning([])).toBeNull();
  });
});
