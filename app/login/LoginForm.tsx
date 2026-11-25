'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';

type Turnstile = {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void }) => string;
  reset: (id?: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function useTurnstile(siteKey: string) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [token, setToken] = useState('');

  useEffect(() => {
    const mount = () => {
      if (!box.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: siteKey, callback: setToken, 'expired-callback': () => setToken(''),
      });
    };
    if (window.turnstile) return mount();
    const s = document.createElement('script');
    s.src = SCRIPT; s.async = true; s.onload = mount;
    document.head.appendChild(s);
  }, [siteKey]);

  const reset = () => { setToken(''); window.turnstile?.reset(widget.current); };
  return { box, token, reset };
}

export function LoginForm({ siteKey }: { siteKey: string }) {
  const { box, token, reset } = useTurnstile(siteKey);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: f.get('username'), password: f.get('password'), turnstileToken: token }),
    }).catch(() => null);
    if (res?.ok) { window.location.assign('/'); return; }
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? 'Something went wrong. Try again.');
    setBusy(false); reset();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, width: 'min(340px, 100%)' }}>
      <h1>Sign in</h1>
      <label>Username<input name="username" autoComplete="username" required style={{ width: '100%' }} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required style={{ width: '100%' }} /></label>
      <div ref={box} />
      {error && <p role="alert" style={{ color: 'var(--bad)' }}>{error}</p>}
      <button type="submit" className="btn primary" disabled={busy || !token}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
