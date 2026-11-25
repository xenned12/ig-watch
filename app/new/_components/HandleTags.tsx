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

export function HandleTags({ tags, value, max, invalid, describedBy, inputRef, onValueChange, onCommit, onRemove }: Props) {
  const full = tags.length >= max;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!full && value.trim() !== '') onCommit(value);
    } else if (e.key === 'Backspace' && value === '' && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  }

  function onChange(next: string) {
    if (next.includes(',')) onCommit(next);
    else onValueChange(next);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    if (full) return;
    const text = e.clipboardData.getData('text');
    if (/[,\s]/.test(text.trim())) {
      e.preventDefault();
      onCommit(value + text);
    }
  }

  return (
    <div className="tags">
      {tags.map((t, i) => (
        <span className="tag" key={t}>
          @{t}
          <button type="button" aria-label={`Remove @${t}`} onClick={() => onRemove(i)}>
            <Icon name="x" size={15} />
          </button>
        </span>
      ))}
      {/* readOnly (not disabled) at the limit so focus can return here after removing a tag. */}
      <input
        id="comp-in"
        ref={inputRef}
        value={value}
        placeholder={full ? 'Limit reached' : 'Type a handle and press Enter'}
        readOnly={full}
        aria-disabled={full || undefined}
        autoComplete="off"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
    </div>
  );
}
