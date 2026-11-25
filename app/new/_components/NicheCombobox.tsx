'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/app/_components/Icon';
import { NICHE_MAX, nicheSuggestions } from '@/lib/handles';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

// Free-text niche with a suggestion list (ARIA combobox, list autocomplete).
// Typing filters suggestions; any text is accepted.
export function NicheCombobox({ value, onChange, onBlur, error, inputRef }: Props) {
  const listId = useId();
  const msgId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = nicheSuggestions(value).filter((o) => o.toLowerCase() !== value.trim().toLowerCase());
  const showList = open && options.length > 0;

  function pick(o: string) {
    onChange(o);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (options.length ? (a + 1) % options.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1));
    } else if (e.key === 'Enter' && showList && active >= 0) {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="field">
      <label htmlFor="niche">Niche</label>
      <div className="combo">
        <input
          id="niche"
          ref={inputRef}
          className="input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={msgId}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          maxLength={NICHE_MAX + 10}
          placeholder="Type a niche, like Fitness"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            onBlur?.();
          }}
          onKeyDown={onKeyDown}
        />
        {showList && (
          <ul id={listId} role="listbox" aria-label="Niche suggestions" className="combo-list">
            {options.map((o, i) => (
              <li
                key={o}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="combo-opt"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the input
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {o}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error ? (
        <span className="err" id={msgId}><Icon name="alert" size={15} />{error}</span>
      ) : (
        <span className="help" id={msgId}>Pick a suggestion or type your own.</span>
      )}
    </div>
  );
}
