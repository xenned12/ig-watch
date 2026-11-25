import type { RunDetail } from '@/lib/pipeline/read';

// Placeholder: Task 14 replaces this with the full results view.
export function Results({ detail }: { detail: RunDetail }) {
  const n = detail.run.competitorHandles.length;
  return (
    <div className="pagehead">
      <h1>
        @{detail.run.clientHandle} vs {n} competitor{n === 1 ? '' : 's'}
      </h1>
    </div>
  );
}
