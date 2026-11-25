// Run statuses the browser has already seen (Runs list, sidebar, run pages).
// The run page's loading skeleton uses it to match what is about to load:
// progress steps for a running analysis, the results layout otherwise.
// In-memory only: it lasts for the visit, which is all a skeleton needs.

export type KnownStatus = 'fetching' | 'transcribing' | 'analyzing' | 'done' | 'failed';

const known = new Map<string, KnownStatus>();

export function rememberStatus(id: string, status: KnownStatus | string | undefined): void {
  if (status === 'fetching' || status === 'transcribing' || status === 'analyzing' || status === 'done' || status === 'failed') {
    known.set(id, status);
  }
}

export function knownStatus(id: string): KnownStatus | undefined {
  return known.get(id);
}

export function isActive(status: KnownStatus | undefined): boolean {
  return status === 'fetching' || status === 'transcribing' || status === 'analyzing';
}
