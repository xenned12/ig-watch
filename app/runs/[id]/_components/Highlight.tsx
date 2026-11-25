import { Fragment } from 'react';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps case-insensitive matches of `query` in <mark>. React escapes the text itself. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{i % 2 === 1 ? <mark>{part}</mark> : part}</Fragment>
      ))}
    </>
  );
}
