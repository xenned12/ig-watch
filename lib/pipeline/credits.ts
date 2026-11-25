// Recognizes Apify "the account is out of credits" errors (scraping, transcription
// and the AI analysis all bill to Apify), so the app can say so plainly instead of showing a generic failure.

export const APIFY_OUT_OF_CREDITS =
  'The Apify account is out of credits. Add credits in Apify billing, then try again.';

type ErrorShape = { status?: unknown; statusCode?: unknown; type?: unknown; message?: unknown };

function shape(err: unknown): ErrorShape {
  return typeof err === 'object' && err !== null ? (err as ErrorShape) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Apify refuses to start an actor, or its AI proxy answers 402, once the balance or usage limit is used up. */
export function isApifyOutOfCredits(err: unknown): boolean {
  const e = shape(err);
  const status = e.statusCode ?? e.status;
  const detail = `${text(e.type)} ${text(e.message)}`;
  if (/not-enough-usage|usage[- ]limit|hard limit|insufficient (credit|fund)|out of credit|upgrade your plan/i.test(detail)) {
    return true;
  }
  return status === 402;
}
