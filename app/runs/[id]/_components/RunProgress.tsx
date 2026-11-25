'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/Icon';
import { browserSupabase } from '@/lib/supabase-browser';
import type { ProgressEvent } from '@/lib/progress';
import type { RunDetail } from '@/lib/pipeline/read';

type Subscribe = (onEvent: (e: ProgressEvent) => void) => () => void;
type Props = {
  run: RunDetail['run'];
  initialEvents: RunDetail['events'];
  onEvent?: (e: ProgressEvent) => void;
  subscribe?: Subscribe;
};

const STEPS = [
  { name: 'Fetch videos', desc: 'Pulling recent reels from every account' },
  { name: 'Rank', desc: 'Keeping the top reels per account' },
  { name: 'Transcribe', desc: 'Turning spoken audio into text' },
  { name: 'Analyze', desc: 'Comparing patterns across accounts' },
  { name: 'Write scripts', desc: 'Drafting scripts for the client' },
];
const ACTIVE = ['fetching', 'transcribing', 'analyzing'];
const POLL_MS = 15_000;

function stepFor(status: string): number {
  if (status === 'transcribing') return 2;
  if (status === 'analyzing') return 3;
  if (status === 'done') return 5;
  return 0;
}

function makeSupabaseSubscribe(runId: string): Subscribe {
  return (onEvent) => {
    const supabase = browserSupabase();
    if (!supabase) return () => {};
    const channel = supabase
      .channel(`run:${runId}`)
      .on('broadcast', { event: 'progress' }, (msg) => onEvent(msg.payload as ProgressEvent))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  };
}

export function RunProgress({ run, initialEvents, onEvent, subscribe }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(stepFor(run.status));
  const [counts, setCounts] = useState<{ n: number; total: number | null }>({ n: 0, total: null });
  const [lines, setLines] = useState(initialEvents.map((e) => e.message));
  const logRef = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const handle = (e: ProgressEvent) => {
      setLines((l) => [...l, e.message]);
      if (e.step === 'rank') setStep((s) => Math.max(s, 2));
      else if (e.step === 'transcribe') {
        setStep((s) => Math.max(s, 2));
        if (e.transcribed !== undefined && e.total !== undefined) setCounts({ n: e.transcribed, total: e.total });
      } else if (e.step === 'analyze') setStep((s) => Math.max(s, 3));
      else if (e.step === 'done') {
        setStep(5);
        router.refresh();
      } else if (e.step === 'failed') router.refresh();
      onEventRef.current?.(e);
    };
    return (subscribe ?? makeSupabaseSubscribe(run.id))(handle);
  }, [run.id, subscribe, router]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = (await res.json()) as RunDetail;
        if (!ACTIVE.includes(d.run.status)) {
          router.refresh();
          return;
        }
        setStep((s) => Math.max(s, stepFor(d.run.status)));
        setLines(d.events.map((e) => e.message));
        if (d.posts.length > 0) setCounts({ n: d.posts.filter((p) => p.transcript).length, total: d.posts.length });
      } catch {
        // Missed poll: the next tick retries.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [run.id, router]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const total = counts.total ?? 0;
  const counter = step > 2 ? `${total}/${total}` : `${step === 2 ? counts.n : 0}/${counts.total ?? '–'}`;

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">{run.niche} · last 90 days</p>
          <h1>Analyzing @{run.clientHandle}</h1>
        </div>
      </div>
      <div className="two">
        <div className="card">
          <div className="steps" aria-live="polite">
            {STEPS.map((s, i) => {
              const state = i < step ? 'done' : i === step ? 'active' : '';
              return (
                <div key={s.name} className={`step ${state}`}>
                  <span className="dot">{state === 'done' ? <Icon name="check" size={15} /> : state ? '' : i + 1}</span>
                  <div>
                    <p className="step-name" style={{ fontWeight: 500 }}>{s.name}</p>
                    <p className="small muted">{s.desc}</p>
                    {i === 2 && step === 2 && (
                      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={counts.n} aria-label="Transcription progress">
                        <i style={{ width: `${total ? (counts.n / total) * 100 : 0}%` }} />
                      </div>
                    )}
                  </div>
                  {i === 2 && <span className={`num small ${state ? '' : 'muted'}`}>{counter}</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Activity</h2>
          <div className="log" role="log" ref={logRef}>
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          <p className="xs muted">You can leave this page. The run keeps going and appears under Runs.</p>
        </div>
      </div>
    </>
  );
}
