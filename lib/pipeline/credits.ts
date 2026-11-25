// Recognizes "the paid account is out of credits" errors from the AI and scraping
// providers, so the app can say so plainly instead of showing a generic failure.

export const OPENAI_OUT_OF_CREDITS =
  'The OpenAI account is out of credits. Add credits in OpenAI billing, then retry the failed step.';
export const APIFY_OUT_OF_CREDITS =
  'The Apify account is out of credits. Add credits in Apify billing, then try again.';

type ErrorShape = { status?: unknown; statusCode?: unknown; code?: unknown; type?: unknown; message?: unknown };

function shape(err: unknown): ErrorShape {
  return typeof err === 'object' && err !== null ? (err as ErrorShape) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** OpenAI answers 429 for both rate limits and an empty balance; only the latter counts. */
export function isOpenAIOutOfCredits(err: unknown): boolean {
  const e = shape(err);
  if (e.status !== 429) return false;
  if (text(e.code) === 'insufficient_quota') return true;
  return /no credits|insufficient[_ ]quota|exceeded your current quota/i.test(text(e.message));
}

/** Apify refuses to start an actor when the account's usage limit or balance is used up. */
export function isApifyOutOfCredits(err: unknown): boolean {
  const e = shape(err);
  const status = e.statusCode ?? e.status;
  const detail = `${text(e.type)} ${text(e.message)}`;
  if (/not-enough-usage|usage[- ]limit|hard limit|insufficient (credit|fund)|out of credit|upgrade your plan/i.test(detail)) {
    return true;
  }
  return status === 402;
}
