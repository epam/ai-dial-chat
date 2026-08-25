import { describe, expect, it } from 'vitest';
import { formatDateYMD } from '../date';

describe('formatDateYMD', () => {
  it('formats a date with zero-padded month and day', () => {
    expect(formatDateYMD(new Date(2026, 6, 4))).toBe('2026-07-04');
  });

  it('formats a date with two-digit month and day unchanged', () => {
    expect(formatDateYMD(new Date(2026, 10, 23))).toBe('2026-11-23');
  });
});
