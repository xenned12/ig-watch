'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/Icon';

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';

/** Retries a failed run. `after` picks what happens on success: refresh this page, or open the run. */
export function RetryButton({ runId, after, className = 'btn' }: { runId: string; after: 'refresh' | 'open'; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry(e: MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/retry`, { method: 'POST' });
      if (res.status === 202) {
        if (after === 'open') router.push(`/runs/${runId}`);
        else router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Something went wrong. Try again.');
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button type="button" className={className} onClick={retry} disabled={busy}>
        <Icon name="retry" size={15} />
        Retry the failed step
      </button>
      {error && (
        <span className="err" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </span>
      )}
    </span>
  );
}
