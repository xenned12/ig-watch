'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Progress = { overflow: boolean; pct: number; seen: number; total: number };

/** How far the box is scrolled, and how many of its lines are fully or partly in view. */
function measure(box: HTMLElement): Progress {
  const lines = [...box.children] as HTMLElement[];
  const bottom = box.scrollTop + box.clientHeight;
  const seen = lines.filter((l) => l.offsetTop - box.offsetTop < bottom).length;
  const overflow = box.scrollHeight > box.clientHeight + 2;
  const pct = overflow ? Math.min(100, Math.round((bottom / box.scrollHeight) * 100)) : 100;
  return { overflow, pct, seen, total: lines.length };
}

/** Transcript box with a hidden scrollbar, a bottom fade and a reading-progress bar with a line count. */
export function ScrollingTranscript({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState<Progress>({ overflow: false, pct: 100, seen: 0, total: 0 });
  const update = useCallback(() => {
    if (box.current) setP(measure(box.current));
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = 0; // a new post starts at the top
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [resetKey, update]);

  const atEnd = p.pct >= 100;
  return (
    <div className="tscroll">
      <div className="tscroll-box">
        <div ref={box} className="transcript" tabIndex={0} role="region" aria-label="Transcript" onScroll={update}>
          {children}
        </div>
        {p.overflow && !atEnd && <div className="tscroll-fade" aria-hidden="true" />}
      </div>
      {p.overflow && (
        <div className="tscroll-meta">
          <div className="tscroll-bar" role="progressbar" aria-label="Transcript read" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct}>
            <span style={{ width: `${p.pct}%` }} />
          </div>
          <p className="xs muted tscroll-count">
            <span>{p.total > 1 ? `${p.seen} of ${p.total} lines` : `${p.pct}% read`}</span>
            <span>{atEnd ? 'End of transcript' : 'Scroll for more'}</span>
          </p>
        </div>
      )}
    </div>
  );
}
