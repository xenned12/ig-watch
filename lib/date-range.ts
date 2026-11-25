/** A run's date range: ISO instants, `since` inclusive and `until` inclusive. */
export type DateWindow = { since: string; until: string };

export const MAX_DAYS = 90;
const DAY_MS = 86_400_000;
// One hour of slack covers daylight-saving days in the viewer's timezone.
const SLACK_MS = 3_600_000;

/** Last 90 days up to `now`: what runs without a saved range used. */
export function defaultWindow(now: Date): DateWindow {
  return { since: new Date(now.getTime() - MAX_DAYS * DAY_MS).toISOString(), until: now.toISOString() };
}

/** Validates a range from the client. Returns an error message, or the cleaned range. */
export function validateWindow(raw: unknown, now: Date): { ok: true; value: DateWindow } | { ok: false; error: string } {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const since = typeof r.since === 'string' ? Date.parse(r.since) : NaN;
  const until = typeof r.until === 'string' ? Date.parse(r.until) : NaN;
  if (Number.isNaN(since) || Number.isNaN(until)) return { ok: false, error: 'Choose a start and end date.' };
  if (since >= until) return { ok: false, error: 'The start date must be before the end date.' };
  if (since > now.getTime()) return { ok: false, error: 'The start date can’t be in the future.' };
  if (until - since > MAX_DAYS * DAY_MS + SLACK_MS) return { ok: false, error: `Choose ${MAX_DAYS} days or fewer.` };
  // A range ending later today is fine; clamp it to now.
  const end = Math.min(until, now.getTime());
  return { ok: true, value: { since: new Date(since).toISOString(), until: new Date(end).toISOString() } };
}

// ---- Calendar dates (YYYY-MM-DD) in the viewer's local timezone ----

export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Days covered by an inclusive pair of calendar dates, or null if invalid. */
export function spanDays(from: string, to: string): number | null {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
}

/** Start of `from` to end of `to`, local time, as a DateWindow. */
export function windowFromDates(from: string, to: string): DateWindow | null {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return null;
  return { since: a.toISOString(), until: new Date(addDays(b, 1).getTime() - 1).toISOString() };
}

export type PresetKey = 'yesterday' | 'last7' | 'lastWeek' | 'lastMonth' | 'last30' | 'last60' | 'last90';
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last60', label: 'Last 60 days' },
  { key: 'last90', label: 'Last 90 days' },
];

/** Calendar dates for a preset. "Last N days" includes today; weeks start on Monday. */
export function presetDates(key: PresetKey, today: Date): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const lastN = (n: number) => ({ from: ymd(addDays(t, -(n - 1))), to: ymd(t) });
  switch (key) {
    case 'yesterday': {
      const y = ymd(addDays(t, -1));
      return { from: y, to: y };
    }
    case 'last7':
      return lastN(7);
    case 'lastWeek': {
      const thisMonday = addDays(t, -((t.getDay() + 6) % 7));
      return { from: ymd(addDays(thisMonday, -7)), to: ymd(addDays(thisMonday, -1)) };
    }
    case 'lastMonth':
      return { from: ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: ymd(new Date(t.getFullYear(), t.getMonth(), 0)) };
    case 'last30':
      return lastN(30);
    case 'last60':
      return lastN(60);
    case 'last90':
      return lastN(90);
  }
}

/** "Nov 1 – Nov 25, 2026" style label for a saved range. */
export function formatWindow(w: DateWindow, timeZone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone };
  const a = new Date(w.since);
  const b = new Date(w.until);
  const year = (d: Date) => new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(d);
  const left = new Intl.DateTimeFormat('en-US', year(a) === year(b) ? opts : { ...opts, year: 'numeric' }).format(a);
  const right = new Intl.DateTimeFormat('en-US', { ...opts, year: 'numeric' }).format(b);
  return left === right.replace(/, \d{4}$/, '') && year(a) === year(b) ? right : `${left} – ${right}`;
}

/** Label for a run's range; runs made before ranges existed used the last 90 days. */
export function runRangeLabel(run: { rangeSince: string | null; rangeUntil: string | null }, timeZone?: string): string {
  return run.rangeSince && run.rangeUntil
    ? formatWindow({ since: run.rangeSince, until: run.rangeUntil }, timeZone)
    : 'the last 90 days';
}
