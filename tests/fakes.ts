import type { Deps } from '@/lib/pipeline/deps';
import type { ProgressEvent } from '@/lib/progress';
import { memoryStore } from '@/lib/store/memory';

export type FakeDeps = Deps & {
  sent: { path: string; body: object }[];
  events: ProgressEvent[];
};

export function fakeDeps(overrides: Partial<Deps> = {}): FakeDeps {
  const sent: { path: string; body: object }[] = [];
  const events: ProgressEvent[] = [];
  const base: Deps = {
    store: memoryStore(),
    progress: {
      async emit(_runId, e) {
        events.push(e);
      },
    },
    async sendJob(path, body) {
      sent.push({ path, body });
    },
    accountSearch: {
      async start() {
        throw new Error('accountSearch not faked');
      },
      async result() {
        return { state: 'running' };
      },
    },
    apify: {
      async start() {
        return 'apify-1';
      },
      async items() {
        return [];
      },
    },
    openai: {
      async transcribe() {
        return { text: '', segments: [] };
      },
      async json() {
        throw new Error('openai.json not stubbed');
      },
    },
    async fetchVideo() {
      return new Blob([]);
    },
    now: () => new Date('2026-11-25T00:00:00Z'),
  };
  return Object.assign({ ...base, ...overrides }, { sent, events });
}
