export interface Batcher<T> {
  /** Queue a key-value pair. Resets the flush timer if not already running. */
  add(key: string, value: T): void;
  /** Immediately flush all pending entries. */
  flush(): void;
  /** Cancel pending flush and discard all entries. */
  destroy(): void;
}

/**
 * Batches rapid writes into a single flush callback.
 * Within the `delay` window, only the last value per key is kept.
 */
export function createBatcher<T>(
  onFlush: (entries: Map<string, T>) => void,
  delay = 16,
): Batcher<T> {
  const pending = new Map<string, T>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size > 0) {
      const snapshot = new Map(pending);
      pending.clear();
      onFlush(snapshot);
    }
  }

  return {
    add(key, value) {
      pending.set(key, value);
      if (!timer) {
        timer = setTimeout(flush, delay);
      }
    },
    flush,
    destroy() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending.clear();
    },
  };
}
