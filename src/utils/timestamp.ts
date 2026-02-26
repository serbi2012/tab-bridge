/**
 * Monotonically increasing timestamp.
 * Guarantees each call returns a strictly greater value than the previous,
 * which is essential for LWW conflict resolution within a single tab.
 */
let lastTimestamp = 0;

export function monotonic(): number {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}
