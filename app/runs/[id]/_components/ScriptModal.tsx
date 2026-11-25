'use client';

import { Icon } from '@/app/_components/Icon';
import { Modal } from '@/app/_components/Modal';
import { copyText, useToast } from '@/app/_components/Toast';
import { beatParts, scriptCopyText, scriptVoiceover, wordCount } from '@/lib/script-view';
import type { Script } from '@/lib/types';

type Props = { script: Script; index: number; total: number; onClose: () => void };

// Full, read-on-camera script: one row per timed beat with the exact voiceover,
// the on-screen text and a filming note. No Prev/Next: one script at a time.
export function ScriptModal({ script: s, index, total, onClose }: Props) {
  const toast = useToast();
  const beats = s.beats.map(beatParts);
  const words = wordCount(scriptVoiceover(s));
  const legacy = beats.some((b) => b.legacy);

  return (
    <Modal labelledBy="script-title" onClose={onClose} wide>
      <div className="mhead">
        <div className="script-head">
          <p className="eyebrow">Recommended script {index + 1} of {total}</p>
          <h2 id="script-title" className="script-title">{s.name}</h2>
          <div className="script-meta">
            <span className="pill grey num">{s.lengthS}s</span>
            <span className="pill grey num">{beats.length} beats</span>
            {!legacy && <span className="pill grey num">{words} words</span>}
          </div>
          {s.patterns.length > 0 && (
            <ul className="script-patterns" aria-label="Winning patterns this script uses">
              {s.patterns.map((p) => <li key={p} className="pill blue">{p}</li>)}
            </ul>
          )}
        </div>
        <button className="btn ghost sm" data-close onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>

      <div className="mbody">
        {legacy && (
          <p className="notice small">
            <Icon name="alert" size={15} />
            This script was saved before full scripts were added, so it shows one line per beat. Re-run the analysis for a word-for-word version.
          </p>
        )}
        <ol className="script-beats" aria-label="Full script">
          {beats.map((b, i) => {
            const role = i === 0 ? 'Hook' : i === beats.length - 1 ? 'Call to action' : null;
            return (
              <li key={i} className={role ? 'beat key' : 'beat'}>
                <div className="beat-time">
                  <span className="mono">{b.at}</span>
                  {role && <span className="beat-role">{role}</span>}
                </div>
                <div className="beat-body">
                  <p className="beat-vo">{b.voiceover}</p>
                  {b.onScreen.trim() && (
                    <p className="beat-note">
                      <Icon name="cap" size={15} />
                      <span><span className="beat-label">On screen</span> {b.onScreen}</span>
                    </p>
                  )}
                  {b.direction.trim() && (
                    <p className="beat-note muted">
                      <Icon name="play" size={15} />
                      <span><span className="beat-label">Shot</span> {b.direction}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mfoot">
        <button className="btn sm" onClick={() => void copyText(scriptVoiceover(s), 'Voiceover', toast)}>
          <Icon name="mic" size={15} />
          Copy voiceover only
        </button>
        <button className="btn primary sm" onClick={() => void copyText(scriptCopyText(s), 'Script', toast)}>
          <Icon name="copy" size={15} />
          Copy full script
        </button>
      </div>
    </Modal>
  );
}
