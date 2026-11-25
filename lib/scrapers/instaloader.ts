import 'server-only';
import { spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Scraper, ScrapeDone } from './types';

type Options = {
  python: string;
  script: string;
  dir: string;
  login?: string;
  /** Delivers the finish event to the app's own webhook. */
  notify: (done: ScrapeDone) => Promise<void>;
  spawn?: typeof nodeSpawn;
  id?: () => string;
  /** Wait before notifying so startRun has stored this scrape's id. */
  delayMs?: number;
};

const ID_RE = /^il_[a-f0-9-]+$/;

// Runs scripts/instaloader_scrape.py in the background. Local use only: it needs
// Python and a long-lived server process, which Vercel functions don't have.
export function instaloaderScraper(o: Options): Scraper {
  const spawn = o.spawn ?? nodeSpawn;
  const newId = o.id ?? (() => 'il_' + randomUUID());
  const delay = o.delayMs ?? 2_000;

  return {
    async start(handles, runId) {
      mkdirSync(o.dir, { recursive: true });
      const id = newId();
      const out = join(o.dir, id + '.json');
      const args = [o.script, '--out', out, ...(o.login ? ['--login', o.login] : []), ...handles];
      const child = spawn(o.python, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, PYTHONWARNINGS: 'ignore' },
      });

      let finished = false;
      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        const done: ScrapeDone = { runId, eventType: ok ? 'ACTOR.RUN.SUCCEEDED' : 'ACTOR.RUN.FAILED', apifyRunId: id };
        setTimeout(() => void o.notify(done).catch(() => undefined), delay);
      };

      try {
        const log = createWriteStream(join(o.dir, id + '.log'));
        child.stderr?.on('data', (chunk: Buffer) => log.write(chunk));
        child.on('close', () => log.end());
      } catch {
        // Logging is best effort.
      }
      child.on('error', () => finish(false));
      child.on('close', (code: number | null) => finish(code === 0));
      return id;
    },

    async items(id) {
      if (!ID_RE.test(id)) throw new Error('Unknown scrape id');
      const data: unknown = JSON.parse(await readFile(join(o.dir, id + '.json'), 'utf8'));
      if (!Array.isArray(data)) throw new Error('Scrape output is not a list');
      return data;
    },
  };
}
