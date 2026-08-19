import { describe, expect, it } from 'vitest';
import { formatPrice, formatUnitPrice } from '../format-price';

describe('formatPrice', () => {
  it('formats amounts of a dollar or more with up to two decimals', () => {
    expect(formatPrice(3)).toBe('$3');
    expect(formatPrice(12.345)).toBe('$12.35');
    expect(formatPrice(10000)).toBe('$10,000');
  });

  it('keeps up to six decimals for sub-dollar amounts', () => {
    expect(formatPrice(0.3)).toBe('$0.3');
    expect(formatPrice(0.000003)).toBe('$0.000003');
  });

  it('formats zero without decimals', () => {
    expect(formatPrice(0)).toBe('$0');
  });
});

describe('formatUnitPrice', () => {
  it('re-quotes token prices per 1M tokens', () => {
    expect(formatUnitPrice('0.000003', 'token')).toBe('$3/M tokens');
    expect(formatUnitPrice('0.0000003', 'token')).toBe('$0.3/M tokens');
  });

  it('treats a missing unit as tokens', () => {
    expect(formatUnitPrice('0.000015', undefined)).toBe('$15/M tokens');
  });

  it('keeps the per-unit price for non-token units and spells the unit out', () => {
    expect(formatUnitPrice('0.5', 'char_without_whitespace')).toBe(
      '$0.5/char without whitespace',
    );
  });

  it('returns undefined when there is no price', () => {
    expect(formatUnitPrice(undefined, 'token')).toBeUndefined();
  });

  it('returns the original string when it is not a finite number', () => {
    expect(formatUnitPrice('free', 'token')).toBe('free');
    expect(formatUnitPrice('  ', 'token')).toBe('  ');
  });
});
