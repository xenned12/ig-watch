'use client';

import { useState } from 'react';
import { Icon } from '@/app/_components/Icon';
import { scriptVoiceover, wordCount } from '@/lib/script-view';
import type { Script } from '@/lib/types';
import { ScriptModal } from './ScriptModal';

export function ScriptsTab({ clientHandle, scripts }: { clientHandle: string; scripts: Script[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <p className="small muted">
        Written in @{clientHandle}&apos;s voice, using the patterns that win in this niche. Open one to read the full script, word for word.
      </p>
      <div className="scripts">
        {scripts.map((s, i) => (
          <button key={i} className="card scard" onClick={() => setOpen(i)} aria-label={`Open script ${i + 1}: ${s.name}`}>
            <span className="scard-top">
              <span className="mono xs muted">Script {i + 1}</span>
              <span className="pill grey num">{s.lengthS}s · {wordCount(scriptVoiceover(s))} words</span>
            </span>
            <span className="scard-name">{s.name}</span>
            <span className="hook">&quot;{s.hook}&quot;</span>
            <span className="scard-tags">
              {s.patterns.map((u) => (
                <span key={u} className="pill blue" title={u}>{u}</span>
              ))}
            </span>
            <span className="scard-open">
              Read full script <Icon name="right" size={15} />
            </span>
          </button>
        ))}
      </div>
      {open !== null && scripts[open] && (
        <ScriptModal script={scripts[open]} index={open} total={scripts.length} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
