'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'button:not([aria-disabled="true"]), a[href]';

type Props = {
  labelledBy: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  children: ReactNode;
};

export function Modal({ labelledBy, onClose, onPrev, onNext, children }: Props) {
  const scrim = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onClose, onPrev, onNext });
  useLayoutEffect(() => {
    handlers.current = { onClose, onPrev, onNext };
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    scrim.current?.querySelector<HTMLElement>('[data-close]')?.focus();

    function onKey(e: KeyboardEvent) {
      const h = handlers.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        h.onClose();
      } else if (e.key === 'ArrowRight' && h.onNext) {
        h.onNext();
      } else if (e.key === 'ArrowLeft' && h.onPrev) {
        h.onPrev();
      } else if (e.key === 'Tab' && scrim.current) {
        const items = [...scrim.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return createPortal(
    <div
      className="scrim"
      ref={scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
