'use client';

import { useState } from 'react';
import { Icon } from '@/app/_components/Icon';
import { dataNotes, fmt, median, metric, type PostWithTranscript } from '@/lib/view';
import type { RunDetail } from '@/lib/pipeline/read';
import type { Analysis } from '@/lib/types';
import { PostModal } from './PostModal';

const hookOf = (p: PostWithTranscript) => {
  const t = (p.transcript?.text ?? p.caption).trim();
  return t.length > 80 ? `${t.slice(0, 80).trimEnd()}…` : t;
};

type Props = { run: RunDetail['run']; posts: PostWithTranscript[]; analysis: Analysis };

export function OverviewTab({ run, posts, analysis }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = new Map(posts.map((p) => [p.id, p]));
  const handles = [run.clientHandle, ...run.competitorHandles];
  const per = handles.map((h) => ({
    h,
    client: h === run.clientHandle,
    med: median(posts.filter((p) => p.handle === h).map(metric)),
  }));
  const max = Math.max(1, ...per.map((a) => a.med));
  const recs = analysis.recommendations.flatMap((r) => {
    const post = byId.get(r.postId);
    return post ? [{ ...r, post }] : [];
  });
  const open = openId ? byId.get(openId) : undefined;
  const accountList = open
    ? posts.filter((p) => p.handle === open.handle).sort((a, b) => metric(b) - metric(a))
    : [];
  const notes = dataNotes(run, posts);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      <div className="two">
        <section className="card" aria-labelledby="h-views">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <h2 id="h-views">Median views by account</h2>
            <span className="xs muted">top 10 reels each</span>
          </div>
          {per.map((a) => (
            <div key={a.h} className={`cmpbar ${a.client ? 'client' : ''}`}>
              <span className="mono" style={a.client ? { color: 'var(--client)', fontWeight: 500 } : undefined}>@{a.h}</span>
              <span className="track" role="img" aria-label={`@${a.h}: ${fmt(a.med)} median views`}>
                <i style={{ width: `${Math.max(3, (a.med / max) * 100)}%` }} />
              </span>
              <span className="num" style={{ textAlign: 'right' }}>{fmt(a.med)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }} className="xs muted">
            <Swatch color="var(--primary)" label="Competitor" />
            <Swatch color="var(--client)" label="Client" />
          </div>
        </section>
        <section className="card" aria-labelledby="h-diff">
          <h2 id="h-diff" style={{ marginBottom: 6 }}>How @{run.clientHandle} differs</h2>
          {analysis.gaps.map((g, i) => (
            <div className="list-row" key={i}>
              <span style={{ flex: 1 }}>{g.text}</span>
              <span className={`pill ${g.kind === 'gap' ? 'amber' : 'ok'}`}>
                <Icon name={g.kind === 'gap' ? 'alert' : 'check'} size={15} />
                {g.kind === 'gap' ? 'Gap' : 'Keep'}
              </span>
            </div>
          ))}
        </section>
      </div>

      <section className="card" aria-labelledby="h-pat">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 id="h-pat">Similar patterns in top reels</h2>
          <span className="xs muted">how many of each side&apos;s top 10 reels show it</span>
        </div>
        <div className="pat head"><span>Pattern</span><span>Competitors</span><span>Client</span></div>
        {analysis.patterns.map((p) => (
          <div className="pat" key={p.name}>
            <span>{p.name}</span>
            <PatternBar n={p.competitorCount} color="var(--primary)" min={0} />
            <PatternBar n={p.clientCount} color="var(--client)" min={2} />
          </div>
        ))}
      </section>

      <section className="card" aria-labelledby="h-rec">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 id="h-rec">Recommendations</h2>
          <span className="xs muted">each one links to the winning post behind it</span>
        </div>
        {recs.map((r, i) => (
          <div className="rec" key={i}>
            <span className="recn">{i + 1}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <p style={{ fontWeight: 500 }}>{r.text}</p>
              <p className="small muted">{r.reason}</p>
              <button className="linkbtn" onClick={() => setOpenId(r.post.id)}>
                Based on @{r.post.handle} · {fmt(metric(r.post))} {r.post.views == null ? 'likes' : 'views'} · &quot;{hookOf(r.post)}&quot;
              </button>
            </div>
          </div>
        ))}
      </section>

      {notes.length > 0 && (
        <div className="notice">
          <Icon name="alert" size={15} />
          <span><strong>Data notes.</strong> {notes.join(' ')}</span>
        </div>
      )}

      {open && (
        <PostModal
          post={open}
          list={accountList}
          listLabel="for this account"
          fromRecommendation
          allPosts={posts}
          onSelect={(p) => setOpenId(p.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <i style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}

function PatternBar({ n, color, min }: { n: number; color: string; min: number }) {
  return (
    <span>
      <span className="num small" style={{ color }}>{n}/10</span>
      <span className="mini"><i style={{ width: `${Math.max(n * 10, min)}%`, background: color }} /></span>
    </span>
  );
}
