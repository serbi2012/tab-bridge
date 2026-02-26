import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBatcher } from './batch';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createBatcher', () => {
  it('flushes after the delay', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<number>(onFlush, 16);

    batcher.add('a', 1);
    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);

    const entries = onFlush.mock.calls[0][0] as Map<string, number>;
    expect(entries.get('a')).toBe(1);

    batcher.destroy();
  });

  it('keeps only the last value per key within the window', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<number>(onFlush, 16);

    batcher.add('a', 1);
    batcher.add('a', 2);
    batcher.add('a', 3);

    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);

    const entries = onFlush.mock.calls[0][0] as Map<string, number>;
    expect(entries.get('a')).toBe(3);
    expect(entries.size).toBe(1);

    batcher.destroy();
  });

  it('batches multiple keys together', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<string>(onFlush, 16);

    batcher.add('a', 'x');
    batcher.add('b', 'y');

    vi.advanceTimersByTime(16);

    const entries = onFlush.mock.calls[0][0] as Map<string, string>;
    expect(entries.get('a')).toBe('x');
    expect(entries.get('b')).toBe('y');

    batcher.destroy();
  });

  it('manual flush sends immediately', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<number>(onFlush, 16);

    batcher.add('a', 1);
    batcher.flush();

    expect(onFlush).toHaveBeenCalledTimes(1);

    // Timer should be cancelled — no double flush
    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);

    batcher.destroy();
  });

  it('flush with nothing pending is a no-op', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<number>(onFlush, 16);

    batcher.flush();
    expect(onFlush).not.toHaveBeenCalled();

    batcher.destroy();
  });

  it('destroy cancels pending flush', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<number>(onFlush, 16);

    batcher.add('a', 1);
    batcher.destroy();

    vi.advanceTimersByTime(16);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('can be reused after flush', () => {
    const onFlush = vi.fn();
    const batcher = createBatcher<number>(onFlush, 16);

    batcher.add('a', 1);
    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);

    batcher.add('b', 2);
    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(2);

    const entries = onFlush.mock.calls[1][0] as Map<string, number>;
    expect(entries.get('b')).toBe(2);

    batcher.destroy();
  });
});
