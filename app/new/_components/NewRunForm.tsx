'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/Icon';
import { NICHES, normaliseHandle, tagError, validateRunInput, type Niche, type RunInputErrors } from '@/lib/handles';
import { HandleTags } from './HandleTags';

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

function Summary({ total }: { total: number }) {
  return (
    <aside className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2>This run</h2>
      <div className="summary-list">
        <div><span className="muted">Accounts</span><span className="num">{total} <span className="muted xs">of 4–11</span></span></div>
        <div><span className="muted">Window</span><span>Last 90 days</span></div>
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
  const [niche, setNiche] = useState<Niche>(initial?.niche ?? NICHES[0]);
  const [clientText, setClientText] = useState(initial?.client ? '@' + initial.client : '');
  const [comps, setComps] = useState<string[]>(initial?.competitors ?? []);
  const [draft, setDraft] = useState('');
  const [errors, setErrors] = useState<RunInputErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  const client = normaliseHandle(clientText);
  const total = comps.length + (client ? 1 : 0);

  function commit(raw: string): string[] {
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
    return next;
  }

  function checkClient(raw: string) {
    const h = normaliseHandle(raw);
    setClientText(h ? '@' + h : '');
    const r = validateRunInput({ niche, client: h, competitors: comps });
    setErrors((p) => ({ ...p, client: r.ok ? undefined : r.errors.client }));
  }

  function remove(i: number) {
    setComps((c) => c.filter((_, idx) => idx !== i));
    setErrors((p) => ({ ...p, competitors: undefined }));
    compRef.current?.focus();
  }

  function clear() {
    setNiche(NICHES[0]);
    setClientText('');
    setComps([]);
    setDraft('');
    setErrors({});
    setFormError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError('');
    const list = draft.trim() ? commit(draft) : comps;
    const r = validateRunInput({ niche, client, competitors: list });
    if (!r.ok) {
      setErrors(r.errors);
      (r.errors.client ? clientRef : compRef).current?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(r.value),
      });
      const body = (await res.json()) as { runId?: string; errors?: RunInputErrors; error?: string };
      if (res.status === 201 && body.runId) {
        router.push('/runs/' + body.runId);
        return;
      }
      if (res.status === 400 && body.errors) setErrors(body.errors);
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
          <div className="field">
            <span style={{ fontSize: 13, fontWeight: 500 }} id="niche-l">Niche</span>
            <div className="segs" role="group" aria-labelledby="niche-l">
              {NICHES.map((n) => (
                <button key={n} type="button" className="seg" aria-pressed={niche === n} onClick={() => setNiche(n)}>{n}</button>
              ))}
            </div>
            {errors.niche && <span className="err"><Icon name="alert" size={15} />{errors.niche}</span>}
          </div>
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
              onCommit={commit}
              onRemove={remove}
            />
            <FieldMessage id="comp-msg" error={errors.competitors} help="Paste a handle or profile link. Press Enter or comma to add it." />
          </div>
          {formError && <p className="err" role="alert"><Icon name="alert" size={15} />{formError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn ghost" onClick={clear}>Clear</button>
            <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Starting…' : 'Run analysis'}</button>
          </div>
        </form>
        <Summary total={total} />
      </div>
    </>
  );
}
