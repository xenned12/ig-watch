import type { CSSProperties } from 'react';

/** A shimmering placeholder block. Purely visual: hidden from assistive tech. */
export function Skel({ w = '100%', h = 14, r, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className="skel" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Wraps a skeleton screen so screen readers hear one "Loading" status. */
export function SkeletonScreen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // display: contents lets the page layout (e.g. .wrap's 16px gap) space the
    // skeleton's sections exactly like the loaded page.
    <div role="status" aria-busy="true" aria-live="polite" style={{ display: 'contents' }}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
