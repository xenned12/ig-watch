'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/app/_components/Icon';
import { filterPosts, fmt, fmtDate, metric, postText, type PostWithTranscript, type SortKey } from '@/lib/view';
import type { RunDetail } from '@/lib/pipeline/read';
import { Highlight } from './Highlight';
import { PostModal } from './PostModal';

const PAGE = 10;
const DEBOUNCE_MS = 180;

export function PostsTab({ run, posts }: { run: RunDetail['run']; posts: PostWithTranscript[] }) {
  const [acct, setAcct] = useState('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('views');
  const [show, setShow] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input);
      setShow(PAGE);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const list = useMemo(() => filterPosts(posts, { acct, q, sort }), [posts, acct, q, sort]);
  const open = openId ? (list.find((p) => p.id === openId) ?? posts.find((p) => p.id === openId)) : undefined;
  const handles = [run.clientHandle, ...run.competitorHandles];
  const chips: { key: string; label: string; n: number; client?: boolean }[] = [
    { key: 'all', label: 'All accounts', n: posts.length },
    { key: 'comp', label: 'Competitors', n: posts.filter((p) => !p.isClient).length },
    ...handles.map((h) => ({
      key: h,
      label: `@${h}`,
      n: posts.filter((p) => p.handle === h).length,
      client: h === run.clientHandle,
    })),
  ];
  const found = handles.filter((h) => run.videosFound[h] != null).map((h) => `@${h} ${run.videosFound[h]}`);
  const filtering = acct !== 'all' || q.trim() !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <div className="toolbar" role="group" aria-label="Filter by account">
        {chips.map((c) => (
          <button
            key={c.key}
            className={`chip ${c.client ? 'client' : ''}`}
            aria-pressed={acct === c.key}
            onClick={() => {
              setAcct(c.key);
              setShow(PAGE);
            }}
          >
            {c.label} <span className="num xs">{c.n}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder="Search transcripts: prompt, editor, comment"
            aria-label="Search transcripts"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="small muted">Sort</span>
          <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="views">Most views</option>
            <option value="new">Newest</option>
            <option value="len">Longest</option>
          </select>
        </label>
      </div>
      <p className="small muted" aria-live="polite">
        {list.length} of {posts.length} video posts{q.trim() ? ` mention "${q.trim()}"` : ''}.
        {found.length > 0 && ` Found in the last 90 days: ${found.join(', ')}.`} Only each account&apos;s top 10 by views are kept.
      </p>
      <div className="posts">
        {list.length > 0 ? (
          list.slice(0, show).map((p, i) => {
            const unit = p.views == null ? 'likes' : 'views';
            return (
              <button
                key={p.id}
                className="prow"
                onClick={() => setOpenId(p.id)}
                aria-label={`Open transcript: @${p.handle}, ${fmt(metric(p))} ${unit}, ${fmtDate(p.postedAt)}`}
              >
                <span className="rank">{i + 1}</span>
                <span style={{ minWidth: 0, display: 'block' }}>
                  <span className={`who ${p.isClient ? 'client' : ''}`}>@{p.handle}</span>{' '}
                  <span className="xs muted">
                    · {fmtDate(p.postedAt)} · {p.durationS}s{p.transcript?.source === 'caption' ? ' · caption only' : ''}
                    {p.views == null ? ' · ranked by likes' : ''}
                  </span>
                  <span className="clamp"><Highlight text={postText(p)} query={q} /></span>
                </span>
                <span className="views">
                  {fmt(metric(p))}
                  <br />
                  <span className="xs muted" style={{ fontFamily: 'var(--f-sans)' }}>{unit}</span>
                </span>
                <span className="open">
                  Transcript <Icon name="right" size={15} />
                </span>
              </button>
            );
          })
        ) : (
          <div className="empty">
            <p style={{ fontWeight: 500 }}>No transcripts mention &quot;{q.trim()}&quot;</p>
            <p className="small muted">Try &quot;AI&quot;, &quot;prompt&quot; or &quot;comment&quot;, or pick a different account.</p>
            <button
              className="btn sm"
              onClick={() => {
                setInput('');
                setQ('');
              }}
            >
              Clear search
            </button>
          </div>
        )}
      </div>
      {list.length > show && (
        <button className="btn" onClick={() => setShow((n) => n + PAGE)}>
          Show 10 more <span className="muted small">({list.length - show} left)</span>
        </button>
      )}
      {open && (
        <PostModal
          post={open}
          list={list}
          listLabel={filtering ? 'in this filter' : ''}
          query={q}
          allPosts={posts}
          onSelect={(p) => setOpenId(p.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
