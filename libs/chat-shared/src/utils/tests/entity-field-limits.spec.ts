import { describe, expect, it } from 'vitest';
import {
  ENTITY_NAME_MAX_LENGTH,
  exceedsMaxLength,
  hasControlCharacters,
} from '../entity-field-limits';

describe('exceedsMaxLength', () => {
  it('accepts a value exactly at the limit', () => {
    expect(
      exceedsMaxLength(
        'a'.repeat(ENTITY_NAME_MAX_LENGTH),
        ENTITY_NAME_MAX_LENGTH,
      ),
    ).toBe(false);
  });

  it('rejects a value one character over the limit', () => {
    expect(
      exceedsMaxLength(
        'a'.repeat(ENTITY_NAME_MAX_LENGTH + 1),
        ENTITY_NAME_MAX_LENGTH,
      ),
    ).toBe(true);
  });
});

describe('hasControlCharacters', () => {
  it('flags line breaks, tabs and NUL', () => {
    expect(hasControlCharacters('a\nb')).toBe(true);
    expect(hasControlCharacters('a\tb')).toBe(true);
    expect(hasControlCharacters('a\u0000b')).toBe(true);
  });

  it('accepts printable text including non-Latin scripts', () => {
    expect(hasControlCharacters('My toolset — مرحبا 1.0')).toBe(false);
  });
});
