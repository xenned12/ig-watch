/** Reads "Crawled 147/191 pages" out of an Apify status message, if present. */
export function crawlProgress(message: string | null | undefined): { done: number; total: number } | null {
  const m = message?.match(/Crawled (\d+)\/(\d+) pages/);
  if (!m) return null;
  const done = Number(m[1]);
  const total = Number(m[2]);
  return total > 0 ? { done: Math.min(done, total), total } : null;
}
