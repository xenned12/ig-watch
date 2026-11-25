import { describe, expect, it } from 'vitest';
import { crawlProgress } from '@/lib/scrape-progress';

describe('crawlProgress', () => {
  it('reads crawled/total pages from an Apify status message', () => {
    expect(crawlProgress('Crawled 147/191 pages, 0 failed requests, desired concurrency 160.')).toEqual({ done: 147, total: 191 });
  });
  it('returns null for messages without page counts', () => {
    expect(crawlProgress('Starting the crawler.')).toBeNull();
    expect(crawlProgress(null)).toBeNull();
    expect(crawlProgress('Crawled 3/0 pages')).toBeNull();
  });
});
