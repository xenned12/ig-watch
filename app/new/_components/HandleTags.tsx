'use client';

import type { ClipboardEvent, KeyboardEvent, Ref } from 'react';
import { Icon } from '@/app/_components/Icon';

type Props = {
  tags: string[];
  value: string;
  max: number;
  invalid: boolean;
  describedBy: string;
  inputRef: Ref<HTMLInputElement>;
  onValueChange: (value: string) => void;
  onCommit: (raw: string) => void;
  onRemove: (index: number) => void;
};

export function HandleTags(p: Props) {
  const full = p.tags.length >= p.max;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (p.value.trim() !== '') p.onCommit(p.value);
    } else if (e.key === 'Backspace' && p.value === '' && p.tags.length > 0) {
      p.onRemove(p.tags.length - 1);
    }
  }

  function onChange(next: string) {
    if (next.includes(',')) p.onCommit(next);
    else p.onValueChange(next);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (/[,\s]/.test(text.trim())) {
      e.preventDefault();
      p.onCommit(p.value + text);
    }
  }

  return (
    <div className="tags">
      {p.tags.map((t, i) => (
        <span className="tag" key={t}>
          @{t}
          <button type="button" aria-label={`Remove @${t}`} onClick={() => p.onRemove(i)}>
            <Icon name="x" size={15} />
          </button>
        </span>
      ))}
      <input
        id="comp-in"
        ref={p.inputRef}
        value={p.value}
        placeholder={full ? 'Limit reached' : 'Type a handle and press Enter'}
        disabled={full}
        autoComplete="off"
        aria-describedby={p.describedBy}
        aria-invalid={p.invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
    </div>
  );
}
