'use client';

import { Icon } from '@/app/_components/Icon';
import { Modal } from '@/app/_components/Modal';
import { copyText, useToast } from '@/app/_components/Toast';
import type { Script } from '@/lib/types';

export function scriptCopyText(s: Script): string {
  const beats = s.beats.map((b) => `${b.at}: ${b.text}`).join('\n');
  return `${s.name} (${s.lengthS}s)\n\nHOOK: ${s.hook}\n\n${beats}\n\nCTA: ${s.cta}`;
}

type Props = { scripts: Script[]; index: number; onSelect: (i: number) => void; onClose: () => void };

export function ScriptModal({ scripts, index, onSelect, onClose }: Props) {
  const toast = useToast();
  const s = scripts[index];
  if (!s) return null;
  const hasPrev = index > 0;
  const hasNext = index < scripts.length - 1;

  return (
    <Modal
      labelledBy="mtitle"
      onClose={onClose}
      onPrev={hasPrev ? () => onSelect(index - 1) : undefined}
      onNext={hasNext ? () => onSelect(index + 1) : undefined}
    >
      <div className="mhead">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p className="eyebrow">Script {index + 1} of {scripts.length} · target {s.lengthS}s</p>
          <h2 id="mtitle" style={{ fontSize: 18 }}>{s.name}</h2>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {s.patterns.map((u) => <span key={u} className="pill blue">{u}</span>)}
          </span>
        </div>
        <button className="btn ghost sm" data-close onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      <div className="mbody">
        <div>
          <p className="sec-label">Hook · first 3 seconds</p>
          <p style={{ fontSize: 18, fontWeight: 500, marginTop: 6, lineHeight: 1.4 }}>&quot;{s.hook}&quot;</p>
        </div>
        <div>
          <p className="sec-label" style={{ marginBottom: 4 }}>Beats</p>
          {s.beats.map((b, i) => (
            <div className="list-row" key={i}>
              <span className="mono xs muted" style={{ width: 56, flex: 'none' }}>{b.at}</span>
              <span>{b.text}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="sec-label">Call to action</p>
          <p style={{ marginTop: 6 }}>{s.cta}</p>
        </div>
      </div>
      <div className="mfoot">
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" aria-label="Previous script" aria-disabled={!hasPrev} onClick={() => hasPrev && onSelect(index - 1)}>
            <Icon name="left" size={15} />
            Prev
          </button>
          <button className="btn sm" aria-label="Next script" aria-disabled={!hasNext} onClick={() => hasNext && onSelect(index + 1)}>
            Next
            <Icon name="right" size={15} />
          </button>
        </div>
        <button className="btn primary sm" onClick={() => void copyText(scriptCopyText(s), 'Script', toast)}>
          <Icon name="copy" size={15} />
          Copy script
        </button>
      </div>
    </Modal>
  );
}
