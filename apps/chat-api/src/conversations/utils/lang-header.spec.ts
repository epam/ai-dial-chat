import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertValidOptionalLang,
  LANG_MAX_LENGTH,
} from './lang-header';

describe('assertValidOptionalLang', () => {
  it.each(['en', 'uk', 'en-US', 'zh-Hans', 'pt-BR', 'es-419'])(
    'returns supported language %s unchanged',
    (lang) => {
      expect(assertValidOptionalLang(lang)).toBe(lang);
    },
  );

  it('accepts an omitted language', () => {
    expect(assertValidOptionalLang(undefined)).toBeUndefined();
  });

  it.each([
    '',
    'e',
    '-en',
    'en-',
    'en--US',
    'en US',
    'en_US',
    'X-Lang: en',
    `${'a'.repeat(LANG_MAX_LENGTH + 1)}`,
    'en-US\n',
    '<script>',
  ])('rejects invalid language %j', (lang) => {
    expect(() => assertValidOptionalLang(lang)).toThrow(BadRequestException);
  });

  it('rejects multiple language header values', () => {
    expect(() => assertValidOptionalLang(['en', 'uk'])).toThrow(
      BadRequestException,
    );
  });
});
