'use client';
import { useState } from 'react';
import { Icon } from './Icon';

/** Icon-only sign-out control; the visible account name sits beside it. */
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.assign('/login');
  }
  return (
    <button type="button" className="icon-btn" onClick={logout} disabled={busy}
      aria-label="Sign out" title="Sign out">
      <Icon name="logout" />
    </button>
  );
}
