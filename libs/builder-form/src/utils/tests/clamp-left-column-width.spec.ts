import { describe, expect, it } from 'vitest';
import {
  clampLeftColumnWidth,
  MAX_LEFT_COLUMN_WIDTH,
  MIN_LEFT_COLUMN_WIDTH,
} from '../clamp-left-column-width';

describe('clampLeftColumnWidth', () => {
  it('keeps a width inside the limits', () => {
    expect(clampLeftColumnWidth(500)).toBe(500);
  });

  it('raises a too small width to the minimum', () => {
    expect(clampLeftColumnWidth(10)).toBe(MIN_LEFT_COLUMN_WIDTH);
  });

  it('lowers a too large width to the maximum', () => {
    expect(clampLeftColumnWidth(5000)).toBe(MAX_LEFT_COLUMN_WIDTH);
  });

  it('leaves the center column its minimum width', () => {
    expect(clampLeftColumnWidth(640, { containerWidth: 900 })).toBe(540);
  });

  it('never goes below the minimum in a narrow container', () => {
    expect(clampLeftColumnWidth(400, { containerWidth: 500 })).toBe(
      MIN_LEFT_COLUMN_WIDTH,
    );
  });

  it('falls back to the minimum for a non-finite width', () => {
    expect(clampLeftColumnWidth(Number.NaN)).toBe(MIN_LEFT_COLUMN_WIDTH);
  });

  it('honours custom limits', () => {
    expect(clampLeftColumnWidth(50, { min: 100, max: 200 })).toBe(100);
    expect(clampLeftColumnWidth(500, { min: 100, max: 200 })).toBe(200);
  });
});
