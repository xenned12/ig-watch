/** A post source. `start` kicks off a scrape and later triggers the app's
 * webhook with a ScrapeDone event; `items` returns the scraped posts. */
export interface Scraper {
  start(handles: string[], runId: string): Promise<string>;
  items(scrapeId: string): Promise<unknown[]>;
}

export type ScrapeDone = {
  runId: string;
  eventType: 'ACTOR.RUN.SUCCEEDED' | 'ACTOR.RUN.FAILED';
  apifyRunId: string;
};
