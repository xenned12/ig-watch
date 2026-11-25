/** A post source. `start` kicks off a scrape and later triggers the app's
 * webhook with a ScrapeDone event; `items` returns the scraped posts. */
export interface Scraper {
  start(handles: string[], runId: string): Promise<string>;
  items(scrapeId: string): Promise<unknown[]>;
  /** Optional poll for when the webhook cannot arrive (e.g. local dev).
   * `event` is the finished event type, or null while still running;
   * `message` is the scraper's live status line (e.g. "Crawled 147/191 pages"). */
  status?(scrapeId: string): Promise<{ event: string | null; message: string | null }>;
}

export type ScrapeDone = {
  runId: string;
  eventType: 'ACTOR.RUN.SUCCEEDED' | 'ACTOR.RUN.FAILED';
  apifyRunId: string;
};
