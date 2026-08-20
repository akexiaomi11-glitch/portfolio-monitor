const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60_000;

const attempts = new Map<string, { count: number; blockedUntil: number }>();

export function isBlocked(key: string): boolean {
  const entry = attempts.get(key);
  return entry !== undefined && entry.blockedUntil > Date.now();
}

export function recordFailure(key: string): void {
  const entry = attempts.get(key) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
