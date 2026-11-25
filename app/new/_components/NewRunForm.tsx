'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/Icon';
import { normaliseHandle, tagError, validateNiche, validateRunInput, type Niche, type RunInputErrors } from '@/lib/handles';
import { windowFromDates, formatWindow } from '@/lib/date-range';
import { DateRangeField, defaultRange, rangeError, type DateRange } from './DateRangeField';
import { NicheCombobox } from './NicheCombobox';
import { HandleTags } from './HandleTags';
import { TopAccounts } from './TopAccounts';

export type NewRunInitial = { niche: Niche; client: string; competitors: string[] };

const MAX = 10;
const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';

function FieldMessage({ id, error, help }: { id: string; error?: string; help: string }) {
  return error ? (
    <span className="err" id={id}>
      <Icon name="alert" size={15} />
      {error}
    </span>
  ) : (
    <span className="help" id={id}>{help}</span>
  );
}

function Summary({ total, range }: { total: number; range: DateRange }) {
  const w = windowFromDates(range.from, range.to);
  return (
    <aside className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2>This run</h2>
      <div className="summary-list">
        <div><span className="muted">Accounts</span><span className="num">{total} <span className="muted xs">of 4–11</span></span></div>
        <div><span className="muted">Window</span><span>{w ? formatWindow(w) : '—'}</span></div>
        <div><span className="muted">Posts kept</span><span>Top 10 videos each</span></div>
        <div><span className="muted">Ranked by</span><span>Views, else likes</span></div>
        <div><span className="muted">Estimated time</span><span className="num">~{Math.max(2, Math.round(total * 0.9))} min</span></div>
      </div>
      <p className="xs muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        Only reels and video posts are fetched. Photos and carousels are skipped because they have no speech to
        transcribe. Videos aren&apos;t saved; each post links back to Instagram.
      </p>
    </aside>
  );
}

export function NewRunForm({ initial }: { initial?: NewRunInitial }) {
  const router = useRouter();
  const compRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<HTMLInputElement>(null);
  const nicheRef = useRef<HTMLInputElement>(null);
  const [niche, setNiche] = useState<Niche>(initial?.niche ?? '');
  const [clientText, setClientText] = useState(initial?.client ? '@' + initial.client : '');
  const [comps, setComps] = useState<string[]>(initial?.competitors ?? []);
  const [draft, setDraft] = useState('');
  const [errors, setErrors] = useState<RunInputErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [rangeErr, setRangeErr] = useState<string | undefined>();

  const client = normaliseHandle(clientText);
  const total = comps.length + (client ? 1 : 0);

  function commit(raw: string): { list: string[]; error: string } {
    const next = [...comps];
    let err = '';
    for (const part of raw.split(/[,\s]+/).filter(Boolean)) {
      const h = normaliseHandle(part);
      if (h === '') continue;
      const e = tagError(h, client, next);
      if (e) err = e;
      else if (next.length >= MAX) err = 'You can compare up to 10 competitors.';
      else next.push(h);
    }
    setComps(next);
    setDraft('');
    setErrors((p) => ({ ...p, competitors: err || undefined }));
    return { list: next, error: err };
  }

  function checkClient(raw: string) {
    const h = normaliseHandle(raw);
    setClientText(h ? '@' + h : '');
    const r = validateRunInput({ niche, client: h, competitors: comps });
    setErrors((p) => ({ ...p, client: r.ok ? undefined : r.errors.client }));
  }

  // Chip clicks from the top-accounts list.
  function addHandle(h: string) {
    const e = tagError(h, client, comps);
    if (e) setErrors((p) => ({ ...p, competitors: e }));
    else if (comps.length < MAX) {
      setComps([...comps, h]);
      setErrors((p) => ({ ...p, competitors: undefined }));
    }
  }

  function removeHandle(h: string) {
    setComps((c) => c.filter((x) => x !== h));
    setErrors((p) => ({ ...p, competitors: undefined }));
  }

  function remove(i: number) {
    setComps((c) => c.filter((_, idx) => idx !== i));
    setErrors((p) => ({ ...p, competitors: undefined }));
    compRef.current?.focus();
  }

  function clear() {
    setNiche('');
    setClientText('');
    setComps([]);
    setDraft('');
    setErrors({});
    setFormError('');
    setRange(defaultRange());
    setRangeErr(undefined);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError('');
    const committed = draft.trim() ? commit(draft) : { list: comps, error: '' };
    if (committed.error) {
      // The draft held a handle that could not be added: show why instead of silently dropping it.
      compRef.current?.focus();
      return;
    }
    const list = committed.list;
    const r = validateRunInput({ niche, client, competitors: list });
    const badRange = rangeError(range);
    setRangeErr(badRange);
    if (!r.ok) {
      setErrors(r.errors);
      (r.errors.niche ? nicheRef : r.errors.client ? clientRef : compRef).current?.focus();
      return;
    }
    setErrors({});
    const window = windowFromDates(range.from, range.to);
    if (badRange || !window) return;
    setPending(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...r.value, range: window }),
      });
      const body = (await res.json()) as { runId?: string; errors?: RunInputErrors & { range?: string }; error?: string };
      if (res.status === 201 && body.runId) {
        router.push('/runs/' + body.runId);
        return;
      }
      if (res.status === 400 && body.errors) {
        setErrors(body.errors);
        setRangeErr(body.errors.range);
      }
      else setFormError(body.error ?? 'Something went wrong. Try again.');
    } catch {
      setFormError(NETWORK_ERROR);
    }
    setPending(false);
  }

  return (
    <>
      <div className="pagehead"><div><p className="eyebrow">Step 1 of 2</p><h1>New analysis</h1></div></div>
      <div className="form-grid">
        <form className="card" noValidate onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <NicheCombobox
            value={niche}
            inputRef={nicheRef}
            error={errors.niche}
            onChange={(v) => {
              setNiche(v);
              if (errors.niche) setErrors((p) => ({ ...p, niche: undefined }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, niche: validateNiche(niche) }))}
          />
          <div className="field">
            <label htmlFor="client">Client account</label>
            <input
              className="input mono"
              id="client"
              ref={clientRef}
              value={clientText}
              onChange={(e) => setClientText(e.target.value)}
              placeholder="@yourbrand"
              autoComplete="off"
              aria-describedby="client-msg"
              aria-invalid={errors.client ? true : undefined}
              onBlur={(e) => checkClient(e.target.value)}
            />
            <FieldMessage id="client-msg" error={errors.client} help="The account you're writing scripts for. It must be public." />
          </div>
          <div className="field">
            <label htmlFor="comp-in">Competitors <span className="muted" style={{ fontWeight: 400 }}>({comps.length} added, 3–10 allowed)</span></label>
            <HandleTags
              tags={comps}
              value={draft}
              max={MAX}
              invalid={Boolean(errors.competitors)}
              describedBy="comp-msg"
              inputRef={compRef}
              onValueChange={setDraft}
              onCommit={(raw) => void commit(raw)}
              onRemove={remove}
            />
            <FieldMessage id="comp-msg" error={errors.competitors} help="Paste a handle or profile link. Press Enter or comma to add it." />
          </div>
          <DateRangeField
            value={range}
            error={rangeErr}
            onChange={(r) => {
              setRange(r);
              // Check as soon as the range changes, so a range over 90 days is flagged right away.
              setRangeErr(rangeError(r));
            }}
          />
          <TopAccounts niche={niche} client={client} added={comps} max={MAX} onAdd={addHandle} onRemove={removeHandle} />
          {formError && <p className="err" role="alert"><Icon name="alert" size={15} />{formError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn ghost" onClick={clear}>Clear</button>
            <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Starting…' : 'Run analysis'}</button>
          </div>
        </form>
        <Summary total={total} range={range} />
      </div>
    </>
  );
}
