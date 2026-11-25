'use client';

import { Icon } from '@/app/_components/Icon';
import { MAX_DAYS, PRESETS, presetDates, spanDays, ymd, type PresetKey } from '@/lib/date-range';

export type DateRange = { from: string; to: string };

/** Problem with a picked range, or undefined when it can be used. */
export function rangeError(r: DateRange, today: Date = new Date()): string | undefined {
  if (!r.from || !r.to) return 'Choose a start and end date.';
  if (r.from > r.to) return 'The start date must be before the end date.';
  if (r.from > ymd(today)) return 'The start date can’t be in the future.';
  const days = spanDays(r.from, r.to);
  if (days === null) return 'Choose a start and end date.';
  if (days > MAX_DAYS) return `Choose ${MAX_DAYS} days or fewer. This range is ${days} days.`;
  return undefined;
}

export function defaultRange(today: Date = new Date()): DateRange {
  return presetDates('last90', today);
}

function activePreset(r: DateRange, today: Date): PresetKey | null {
  const hit = PRESETS.find((p) => {
    const d = presetDates(p.key, today);
    return d.from === r.from && d.to === r.to;
  });
  return hit?.key ?? null;
}

export function DateRangeField({
  value,
  error,
  onChange,
}: {
  value: DateRange;
  error?: string;
  onChange: (r: DateRange) => void;
}) {
  const today = new Date();
  const max = ymd(today);
  const active = activePreset(value, today);
  const days = spanDays(value.from, value.to);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <fieldset className="field range-field" aria-describedby="range-msg">
      <legend>Date range</legend>
      <div className="range-presets" role="group" aria-label="Quick ranges">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="chip"
            aria-pressed={active === p.key}
            onClick={() => onChange(presetDates(p.key, today))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="range-inputs">
        <label className="range-date">
          <span className="xs muted">From</span>
          <input
            className="input"
            type="date"
            value={value.from}
            max={value.to && value.to < max ? value.to : max}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </label>
        <label className="range-date">
          <span className="xs muted">To</span>
          <input
            className="input"
            type="date"
            value={value.to}
            min={value.from || undefined}
            max={max}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </label>
      </div>
      {error ? (
        <span className="err" id="range-msg">
          <Icon name="alert" size={15} />
          {error}
        </span>
      ) : (
        <span className="help" id="range-msg">
          {days ? `${days} day${days === 1 ? '' : 's'}, both dates included · ${tz} · ` : ''}Up to {MAX_DAYS} days.
        </span>
      )}
    </fieldset>
  );
}
