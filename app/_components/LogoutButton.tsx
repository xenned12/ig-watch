'use client';

export function LogoutButton() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.assign('/login');
  }
  return <button type="button" className="nav" onClick={logout}>Sign out</button>;
}
