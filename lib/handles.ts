import { z } from 'zod';

// Shared by the browser form and the server: no server-only imports here.

export const NICHES = ['AI', 'Business', 'Finance', 'Gaming', 'Crypto'] as const;
export type Niche = (typeof NICHES)[number];

export const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

const MIN_COMPETITORS = 3;
const MAX_COMPETITORS = 10;

const MSG = {
  niche: 'Choose a niche.',
  clientMissing: "Enter the client's Instagram handle.",
  invalid: "That isn't a valid handle. Use letters, numbers, dots or underscores.",
  clientInCompetitors: (h: string) => `@${h} is also in the competitor list. Remove it there first.`,
  tagIsClient: (h: string) => `@${h} is already the client.`,
  tagDuplicate: (h: string) => `@${h} is already in the list.`,
  needMore: (n: number) => `Add ${n} more competitor${n === 1 ? '' : 's'}. You need 3 to 10.`,
  tooMany: 'You can compare up to 10 competitors.',
} as const;

const INSTAGRAM_PREFIX_RE = /^https?:\/\/(www\.)?instagram\.com\//i;

export function normaliseHandle(raw: string): string {
  return raw
    .trim()
    .replace(INSTAGRAM_PREFIX_RE, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

export type RunInput = { niche: Niche; client: string; competitors: string[] };

export type RunInputErrors = { niche?: string; client?: string; competitors?: string };

export type ValidateResult =
  | { ok: true; value: RunInput }
  | { ok: false; errors: RunInputErrors };

// Lenient shape: bad client or competitor types fall back to empty values and
// are then reported as ordinary handle errors. Only the niche can fail here.
const shape = z.object({
  niche: z.enum(NICHES),
  client: z.string().catch(''),
  competitors: z.array(z.string().catch('')).catch([]),
});

function validateClient(client: string, competitors: string[]): string | undefined {
  if (client === '') return MSG.clientMissing;
  if (!HANDLE_RE.test(client)) return MSG.invalid;
  if (competitors.includes(client)) return MSG.clientInCompetitors(client);
  return undefined;
}

function validateCompetitors(competitors: string[]): string | undefined {
  for (const [i, h] of competitors.entries()) {
    if (!HANDLE_RE.test(h)) return MSG.invalid;
    if (competitors.indexOf(h) !== i) return MSG.tagDuplicate(h);
  }
  if (competitors.length < MIN_COMPETITORS) {
    return MSG.needMore(MIN_COMPETITORS - competitors.length);
  }
  if (competitors.length > MAX_COMPETITORS) return MSG.tooMany;
  return undefined;
}

export function validateRunInput(input: unknown): ValidateResult {
  const raw = typeof input === 'object' && input !== null ? input : {};
  const parsed = shape.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: { niche: MSG.niche } };

  const client = normaliseHandle(parsed.data.client);
  const competitors = parsed.data.competitors.map(normaliseHandle);

  const errors: RunInputErrors = {};
  const clientError = validateClient(client, competitors);
  if (clientError) errors.client = clientError;
  const competitorsError = validateCompetitors(competitors);
  if (competitorsError) errors.competitors = competitorsError;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { niche: parsed.data.niche, client, competitors } };
}

// Per-tag check used by the form while the user types a competitor.
export function tagError(h: string, client: string, existing: string[]): string | null {
  const tag = normaliseHandle(h);
  if (tag === '') return null;
  if (!HANDLE_RE.test(tag)) return MSG.invalid;
  if (tag === normaliseHandle(client)) return MSG.tagIsClient(tag);
  if (existing.map(normaliseHandle).includes(tag)) return MSG.tagDuplicate(tag);
  return null;
}
