import { describe, expect, it } from 'vitest';
import { formatCost, formatPrice, formatUnitPrice } from '../format-price';

describe('formatCost', () => {
  it('rounds accumulated costs to cents', () => {
    expect(formatCost(0.788438)).toBe('$0.79');
    expect(formatCost(0.242753)).toBe('$0.24');
    expect(formatCost(0)).toBe('$0');
  });
});

describe('formatPrice', () => {
  it('formats amounts of a dollar or more with up to two decimals', () => {
    expect(formatPrice(3)).toBe('$3');
    expect(formatPrice(12.345)).toBe('$12.35');
    expect(formatPrice(10000)).toBe('$10,000');
  });

  it('keeps up to six significant digits for sub-dollar amounts', () => {
    expect(formatPrice(0.3)).toBe('$0.3');
    expect(formatPrice(0.000003)).toBe('$0.000003');
    expect(formatPrice(0.1234567)).toBe('$0.123457');
  });

  it('never rounds a non-zero sub-dollar amount to zero', () => {
    expect(formatPrice(0.00000015)).toBe('$0.00000015');
    expect(formatPrice(0.0000035)).toBe('$0.0000035');
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

  it('re-quotes character prices per 1M characters without rounding', () => {
    expect(formatUnitPrice('0.00000015', 'char_without_whitespace')).toBe(
      '$0.15/M chars without whitespace',
    );
    expect(formatUnitPrice('0.0000035', 'char_without_whitespace')).toBe(
      '$3.5/M chars without whitespace',
    );
    expect(formatUnitPrice('0.00000125', 'char_without_whitespace')).toBe(
      '$1.25/M chars without whitespace',
    );
  });

  it('never shows a non-zero per-1M price as $0', () => {
    expect(formatUnitPrice('0.0000000000015', 'token')).toBe(
      '$0.0000015/M tokens',
    );
  });

  it('keeps the per-unit price for other units and spells the unit out', () => {
    expect(formatUnitPrice('0.00000015', 'image_second')).toBe(
      '$0.00000015/image second',
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
