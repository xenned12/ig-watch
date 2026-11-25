import { describe, expect, it } from 'vitest';
import { formatWindow, presetDates, spanDays, validateWindow, windowFromDates } from '@/lib/date-range';

const now = new Date('2026-11-25T06:00:00Z');
const today = new Date(2026, 10, 25); // Wed 25 Nov 2026, local time

describe('presetDates', () => {
  it.each([
    ['yesterday', '2026-11-24', '2026-11-24'],
    ['last7', '2026-11-19', '2026-11-25'],
    ['lastWeek', '2026-11-16', '2026-11-22'],
    ['lastMonth', '2026-10-01', '2026-10-31'],
    ['last30', '2026-10-27', '2026-11-25'],
    ['last60', '2026-09-27', '2026-11-25'],
    ['last90', '2026-08-28', '2026-11-25'],
  ] as const)('%s', (key, from, to) => {
    expect(presetDates(key, today)).toEqual({ from, to });
    expect(spanDays(from, to)).toBeLessThanOrEqual(90);
  });
  it('last week on a Monday is the full previous week', () => {
    expect(presetDates('lastWeek', new Date(2026, 10, 23))).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  });
  it('last month in January is December of the previous year', () => {
    expect(presetDates('lastMonth', new Date(2027, 0, 10))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('validateWindow', () => {
  it('accepts a 90-day range from calendar dates', () => {
    const w = windowFromDates('2026-08-28', '2026-11-25')!;
    expect(validateWindow(w, new Date('2026-11-26T00:00:00Z')).ok).toBe(true);
  });
  it('rejects more than 90 days', () => {
    const w = windowFromDates('2026-08-27', '2026-11-25')!;
    expect(validateWindow(w, new Date('2026-11-26T00:00:00Z'))).toEqual({ ok: false, error: 'Choose 90 days or fewer.' });
  });
  it('rejects a reversed or missing range', () => {
    expect(validateWindow({ since: '2026-11-20T00:00:00Z', until: '2026-11-10T00:00:00Z' }, now).ok).toBe(false);
    expect(validateWindow({}, now)).toEqual({ ok: false, error: 'Choose a start and end date.' });
  });
  it('rejects a start in the future', () => {
    expect(validateWindow({ since: '2026-12-01T00:00:00Z', until: '2026-12-02T00:00:00Z' }, now).ok).toBe(false);
  });
  it('clamps an end later today to now', () => {
    const r = validateWindow({ since: '2026-11-20T00:00:00Z', until: '2026-11-25T23:59:59Z' }, now);
    expect(r).toEqual({ ok: true, value: { since: '2026-11-20T00:00:00.000Z', until: now.toISOString() } });
  });
});

describe('formatWindow', () => {
  it('formats a range in one year', () => {
    expect(formatWindow({ since: '2026-11-01T00:00:00Z', until: '2026-11-25T00:00:00Z' }, 'UTC')).toBe('Nov 1 – Nov 25, 2026');
  });
  it('formats a range across years', () => {
    expect(formatWindow({ since: '2026-12-20T00:00:00Z', until: '2027-01-05T00:00:00Z' }, 'UTC')).toBe('Dec 20, 2026 – Jan 5, 2027');
  });
  it('formats a single day', () => {
    expect(formatWindow({ since: '2026-11-24T00:00:00Z', until: '2026-11-24T23:59:59Z' }, 'UTC')).toBe('Nov 24, 2026');
  });
});
