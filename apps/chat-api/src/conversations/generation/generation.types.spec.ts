import { isValidMaxOutputTokens } from './generation.types';

describe('isValidMaxOutputTokens', () => {
  it('accepts the minimum valid value', () => {
    expect(isValidMaxOutputTokens(1)).toBe(true);
  });

  it('accepts a representative larger positive integer', () => {
    expect(isValidMaxOutputTokens(4096)).toBe(true);
  });

  it('rejects zero', () => {
    expect(isValidMaxOutputTokens(0)).toBe(false);
  });

  it('rejects a negative number', () => {
    expect(isValidMaxOutputTokens(-1)).toBe(false);
  });

  it('rejects a fractional number', () => {
    expect(isValidMaxOutputTokens(1.5)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidMaxOutputTokens(NaN)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidMaxOutputTokens(Infinity)).toBe(false);
  });

  it('rejects a number beyond Number.MAX_SAFE_INTEGER', () => {
    expect(isValidMaxOutputTokens(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('rejects non-number values', () => {
    expect(isValidMaxOutputTokens('4096')).toBe(false);
    expect(isValidMaxOutputTokens(null)).toBe(false);
    expect(isValidMaxOutputTokens(undefined)).toBe(false);
  });
});
