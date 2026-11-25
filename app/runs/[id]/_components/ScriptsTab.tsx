'use client';

import { useState } from 'react';
import { Icon } from '@/app/_components/Icon';
import type { Script } from '@/lib/types';
import { ScriptModal } from './ScriptModal';

export function ScriptsTab({ clientHandle, scripts }: { clientHandle: string; scripts: Script[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <p className="small muted">
        Written in @{clientHandle}&apos;s voice, using the patterns that win in this niche. Open one to see the full script, beat by beat.
      </p>
      <div className="scripts">
        {scripts.map((s, i) => (
          <button key={i} className="card scard" onClick={() => setOpen(i)}>
            <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span className="mono xs muted">Script {i + 1}</span>
              <span className="pill grey num">{s.lengthS}s</span>
            </span>
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            <span className="hook">&quot;{s.hook}&quot;</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {s.patterns.map((u) => <span key={u} className="pill blue">{u}</span>)}
            </span>
            <span className="small" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
              Read full script <Icon name="right" size={15} />
            </span>
          </button>
        ))}
      </div>
      {open !== null && <ScriptModal scripts={scripts} index={open} onSelect={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
