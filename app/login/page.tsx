import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in · Reel Intel' };

export default function LoginPage() {
  return (
    <main className="main" id="main" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <LoginForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''} />
    </main>
  );
}
