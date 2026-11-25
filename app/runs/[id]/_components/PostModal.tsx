'use client';

import { Icon } from '@/app/_components/Icon';
import { Modal } from '@/app/_components/Modal';
import { copyText, useToast } from '@/app/_components/Toast';
import { fmt, fmtClock, fmtDate, metric, postText, type PostWithTranscript } from '@/lib/view';
import { Highlight } from './Highlight';

type Props = {
  post: PostWithTranscript;
  /** Posts that Prev/Next move through, in order. */
  list: PostWithTranscript[];
  /** Extra words after "Post n of N", e.g. "in this filter". */
  listLabel: string;
  /** True when opened from a recommendation. */
  fromRecommendation?: boolean;
  /** Search words to highlight. */
  query?: string;
  /** All posts, to work out the post's rank within its account. */
  allPosts: PostWithTranscript[];
  onSelect: (p: PostWithTranscript) => void;
  onClose: () => void;
};

export function PostModal({ post: p, list, listLabel, fromRecommendation, query = '', allPosts, onSelect, onClose }: Props) {
  const toast = useToast();
  const ix = list.findIndex((x) => x.id === p.id);
  const prev = ix > 0 ? list[ix - 1] : undefined;
  const next = ix >= 0 ? list[ix + 1] : undefined;
  const own = allPosts.filter((x) => x.handle === p.handle).sort((a, b) => metric(b) - metric(a));
  const acctRank = own.findIndex((x) => x.id === p.id) + 1;
  const unit = p.views == null ? 'likes' : 'views';
  const t = p.transcript;
  const segments = t && t.source === 'whisper' ? t.segments : [];
  const isCaption = !t || t.source === 'caption';

  return (
    <Modal labelledBy="mtitle" onClose={onClose} onPrev={prev && (() => onSelect(prev))} onNext={next && (() => onSelect(next))}>
      <div className="mhead">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <p className="eyebrow">
            {fromRecommendation && <span className="pill blue">Winning post behind a recommendation</span>}
            <span>
              Post {ix + 1} of {list.length}
              {listLabel ? ` ${listLabel}` : ''}
            </span>
          </p>
          <h2 id="mtitle" style={{ fontSize: 18, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono" style={p.isClient ? { color: 'var(--client)' } : undefined}>
              @{p.handle}
            </span>
            {p.isClient && <span className="pill amber">Client</span>}
          </h2>
          <p className="small muted">
            #{acctRank} for this account · {fmtDate(p.postedAt, true)} · {p.durationS}s reel
          </p>
        </div>
        <button className="btn ghost sm" data-close onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      <div className="mbody">
        <div className="stats">
          <div className="stat"><p className="xs muted">Views</p><p className="num">{fmt(p.views)}</p></div>
          <div className="stat"><p className="xs muted">Likes</p><p className="num">{fmt(p.likes)}</p></div>
          <div className="stat"><p className="xs muted">Comments</p><p className="num">{fmt(p.comments)}</p></div>
          <div className="stat"><p className="xs muted">Ranked by</p><p className="num">{unit}</p></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="sec-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name={isCaption ? 'cap' : 'mic'} size={15} />
            {isCaption ? 'Caption · no speech found' : 'Transcript · Whisper'}
          </span>
          <button className="btn sm" onClick={() => void copyText(postText(p), 'Transcript', toast)}>
            <Icon name="copy" size={15} />
            Copy transcript
          </button>
        </div>
        <div className="transcript" tabIndex={0} role="region" aria-label="Transcript">
          {segments.length === 0 ? (
            <p><Highlight text={postText(p)} query={query} /></p>
          ) : (
            segments.map((s, i) => (
              <p key={i} style={i > 0 ? { marginTop: 8 } : undefined}>
                <span className="ts">{fmtClock(s.startS)}</span>
                <Highlight text={s.text} query={query} />
              </p>
            ))
          )}
        </div>
        <p className="xs muted">Use ← and → to move between posts. Esc closes.</p>
      </div>
      <div className="mfoot">
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" aria-label="Previous post" aria-disabled={!prev} onClick={() => prev && onSelect(prev)}>
            <Icon name="left" size={15} />
            Prev
          </button>
          <button className="btn sm" aria-label="Next post" aria-disabled={!next} onClick={() => next && onSelect(next)}>
            Next
            <Icon name="right" size={15} />
          </button>
        </div>
        <a className="btn primary sm" href={p.igUrl} target="_blank" rel="noopener noreferrer">
          Open on Instagram <Icon name="ext" size={15} />
        </a>
      </div>
    </Modal>
  );
}
