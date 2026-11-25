import { createHash, timingSafeEqual } from 'node:crypto';

// Hash first so both sides have equal length and the comparison takes constant time.
const digest = (s: string): Buffer => createHash('sha256').update(s).digest();

export function checkCredentials(
  given: { username: string; password: string },
  expected: { username: string; password: string },
): boolean {
  const userOk = timingSafeEqual(digest(given.username), digest(expected.username));
  const passOk = timingSafeEqual(digest(given.password), digest(expected.password));
  return userOk && passOk;
}
