import { Shell } from '@/app/_components/Shell';
import { RunSkeleton } from './_components/RunSkeleton';

// Shown while a run page loads: progress steps for a running analysis,
// the results layout for a finished one (see RunSkeleton).
export default function RunLoading() {
  return (
    <Shell active="runs" recent={null}>
      <RunSkeleton />
    </Shell>
  );
}
