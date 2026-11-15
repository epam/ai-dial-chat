import { describe, expect, it } from 'vitest';
import { resolveLocalizedValue } from '../localized-value';

describe('resolveLocalizedValue', () => {
  it('returns a plain string unchanged', () => {
    expect(resolveLocalizedValue('Display name')).toBe('Display name');
  });

  it('returns the first value of a locale map', () => {
    expect(resolveLocalizedValue({ en: 'Name', de: 'Name DE' })).toBe('Name');
  });

  it('prefers the requested locale of a locale map over its first entry', () => {
    expect(resolveLocalizedValue({ de: 'Name DE', en: 'Name' }, 'en')).toBe(
      'Name',
    );
  });

  it('falls back to the first entry when the requested locale is missing', () => {
    expect(resolveLocalizedValue({ de: 'Name DE' }, 'en')).toBe('Name DE');
  });

  it('preserves an empty string in a locale map', () => {
    expect(resolveLocalizedValue({ en: '' })).toBe('');
  });

  it('returns undefined when no value exists', () => {
    expect(resolveLocalizedValue(undefined)).toBeUndefined();
    expect(resolveLocalizedValue({})).toBeUndefined();
  });

  it('does not return an SDK metadata object as display text', () => {
    const value = { localeMap: { en: 'Name' } } as unknown as Parameters<
      typeof resolveLocalizedValue
    >[0];
    expect(resolveLocalizedValue(value)).toBeUndefined();
  });
});
