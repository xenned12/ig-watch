import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { instaloaderScraper } from '@/lib/scrapers/instaloader';

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
  child.stderr = new EventEmitter();
  return child;
}

function setup(login?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'il-test-'));
  const child = fakeChild();
  const spawn = vi.fn(() => child);
  const notify = vi.fn(async () => undefined);
  const scraper = instaloaderScraper({
    python: '/venv/bin/python',
    script: '/app/scripts/instaloader_scrape.py',
    dir,
    login,
    notify,
    spawn: spawn as never,
    id: () => 'il_0f3a',
    delayMs: 0,
  });
  return { dir, child, spawn, notify, scraper };
}

describe('instaloaderScraper', () => {
  it('starts the script with the handles and an output file, and returns its id', async () => {
    const { dir, spawn, scraper } = setup('mylogin');
    await expect(scraper.start(['me', 'alpha'], 'run-1')).resolves.toBe('il_0f3a');
    expect(spawn).toHaveBeenCalledWith(
      '/venv/bin/python',
      ['/app/scripts/instaloader_scrape.py', '--out', join(dir, 'il_0f3a.json'), '--login', 'mylogin', 'me', 'alpha'],
      expect.objectContaining({ stdio: ['ignore', 'ignore', 'pipe'] }),
    );
  });

  it('reports success to the webhook when the script exits 0', async () => {
    const { child, notify, scraper } = setup();
    await scraper.start(['me'], 'run-1');
    child.emit('close', 0);
    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith({ runId: 'run-1', eventType: 'ACTOR.RUN.SUCCEEDED', apifyRunId: 'il_0f3a' }),
    );
  });

  it('reports failure when the script exits non-zero or cannot start', async () => {
    const a = setup();
    await a.scraper.start(['me'], 'run-1');
    a.child.emit('close', 2);
    await vi.waitFor(() => expect(a.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ACTOR.RUN.FAILED' })));

    const b = setup();
    await b.scraper.start(['me'], 'run-2');
    b.child.emit('error', new Error('ENOENT'));
    await vi.waitFor(() => expect(b.notify).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-2', eventType: 'ACTOR.RUN.FAILED' })));
    expect(b.notify).toHaveBeenCalledTimes(1);
  });

  it('reads the items the script wrote', async () => {
    const { dir, scraper } = setup();
    writeFileSync(join(dir, 'il_0f3a.json'), JSON.stringify([{ ownerUsername: 'me', type: 'Video' }]));
    await expect(scraper.items('il_0f3a')).resolves.toEqual([{ ownerUsername: 'me', type: 'Video' }]);
  });

  it('rejects ids that are not its own (no path tricks)', async () => {
    const { scraper } = setup();
    await expect(scraper.items('../../etc/passwd')).rejects.toThrow('Unknown scrape id');
  });
});
