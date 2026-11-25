import Link from 'next/link';
import { Icon } from '@/app/_components/Icon';
import { APIFY_OUT_OF_CREDITS, OPENAI_OUT_OF_CREDITS } from '@/lib/pipeline/credits';
import type { Step } from '@/lib/types';
import { RetryButton } from '../../_components/RetryButton';

const STEPS: { key: Step; label: string }[] = [
  { key: 'fetch', label: 'Fetch reels' },
  { key: 'transcribe', label: 'Transcribe' },
  { key: 'analyze', label: 'Analyze' },
];


/** A concrete next step for the error, so the page never ends at "it failed". */
function fixFor(error: string | null): string {
  if (error === OPENAI_OUT_OF_CREDITS) {
    return 'Add credits to the OpenAI account, then retry. Finished steps are kept.';
  }
  if (error === APIFY_OUT_OF_CREDITS) {
    return 'Add credits to the Apify account, then retry. Finished steps are kept.';
  }
  return 'Retry the failed step. If it fails again, start a new run with fewer accounts.';
}

type Props = {
  run: { id: string; clientHandle: string; niche: string; failedStep: Step | null; error: string | null; createdAt: string };
};

export function FailedRun({ run }: Props) {
  const failedAt = STEPS.findIndex((s) => s.key === run.failedStep);
  const fix = fixFor(run.error);

  return (
    <div className="incident">
      <header className="incident-head">
        <p className="eyebrow">@{run.clientHandle} · {run.niche}</p>
        <div className="incident-title">
          <h1>Run failed</h1>
          <span className="status-badge bad"><span className="status-dot" aria-hidden="true" />Failed</span>
        </div>
      </header>

      <section className="incident-card" aria-labelledby="incident-error">
        <div className="incident-main">
          <p className="incident-label" id="incident-error">
            <Icon name="alert" size={15} />
            What went wrong
          </p>
          <p className="incident-error" role="alert">{run.error ?? 'Something went wrong.'}</p>

          <div className="incident-fix">
            <p className="incident-label">How to fix it</p>
            <p>{fix}</p>
          </div>

          <div className="incident-actions">
            <RetryButton runId={run.id} after="refresh" className="btn primary" />
            <Link className="btn" href={`/new?from=${run.id}`}>Edit and start again</Link>
          </div>
        </div>

        <aside className="incident-side" aria-label="Run details">
          <p className="incident-label">Pipeline</p>
          <ol className="timeline">
            {STEPS.map((s, i) => {
              const state = failedAt < 0 ? 'todo' : i < failedAt ? 'done' : i === failedAt ? 'failed' : 'todo';
              const note = state === 'done' ? 'Done' : state === 'failed' ? 'Failed here' : 'Not started';
              return (
                <li key={s.key} className={`tl-item ${state}`}>
                  <span className="tl-dot" aria-hidden="true">
                    {state === 'done' && <Icon name="check" size={15} />}
                    {state === 'failed' && <Icon name="x" size={15} />}
                  </span>
                  <span className="tl-text">
                    <span className="tl-label">{s.label}</span>
                    <span className="tl-note">{note}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <dl className="incident-meta">
            <dt>Run ID</dt>
            <dd className="mono">{run.id.slice(0, 8)}</dd>
            <dt>Started</dt>
            <dd>{new Date(run.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
          </dl>
        </aside>
      </section>
    </div>
  );
}
