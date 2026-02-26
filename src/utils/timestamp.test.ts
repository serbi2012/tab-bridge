import { describe, it, expect } from 'vitest';
import { monotonic } from './timestamp';

describe('monotonic', () => {
  it('returns a positive number', () => {
    expect(monotonic()).toBeGreaterThan(0);
  });

  it('returns strictly increasing values on rapid successive calls', () => {
    const values: number[] = [];
    for (let i = 0; i < 1000; i++) {
      values.push(monotonic());
    }
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
