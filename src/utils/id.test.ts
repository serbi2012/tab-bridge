import { describe, it, expect } from 'vitest';
import { generateTabId } from './id';

describe('generateTabId', () => {
  it('returns a valid UUID v4 format', () => {
    const id = generateTabId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTabId()));
    expect(ids.size).toBe(100);
  });
});
