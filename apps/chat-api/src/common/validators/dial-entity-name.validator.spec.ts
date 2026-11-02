import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  DIAL_ENTITY_NAME_FORBIDDEN_CHARS_RE,
  IsDialEntityName,
  isValidDialEntityName,
} from './dial-entity-name.validator';

class NameHolder {
  @IsDialEntityName()
  name!: string;
}

describe('isValidDialEntityName', () => {
  it.each([
    'Handbook',
    'Q4 launch',
    'Отчёт Q4 — 2026',
    'release-1.2_notes',
    'what? #1 (draft)',
    'a'.repeat(255),
    // 2-byte Cyrillic letters: 127 × 2 = 254 bytes
    'ж'.repeat(127),
  ])('accepts %s', (value) => {
    expect(isValidDialEntityName(value)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['leading whitespace', ' name'],
    ['trailing whitespace', 'name '],
    ['a slash', 'a/b'],
    ['a traversal', '../other'],
    ['a backslash', 'a\\b'],
    ['a colon', 'a:b'],
    ['a percent sign', '50%'],
    ['a quote', 'say "hi"'],
    ['a tab', 'a\tb'],
    ['a NUL byte', 'a\u0000b'],
    ['a newline', 'a\nb'],
    ['a bidi override', 'a‮b'],
    ['a dot', '.'],
    ['a double dot', '..'],
    ['the reserved v segment', 'v'],
    ['the reserved files segment', 'files'],
    ['the resource marker', '.dial-resource'],
    ['the folder marker', '.dial-folder'],
    ['256 ASCII characters', 'a'.repeat(256)],
    ['256 UTF-8 bytes', 'ж'.repeat(128)],
  ])('rejects %s', (_label, value) => {
    expect(isValidDialEntityName(value)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidDialEntityName(undefined)).toBe(false);
    expect(isValidDialEntityName(42)).toBe(false);
  });

  it('gives the same answer on repeated calls despite the global regex', () => {
    expect(isValidDialEntityName('a/b')).toBe(false);
    expect(isValidDialEntityName('a/b')).toBe(false);
    expect('a:b/c'.replace(DIAL_ENTITY_NAME_FORBIDDEN_CHARS_RE, ' ')).toBe(
      'a b c',
    );
  });
});

describe('IsDialEntityName', () => {
  it('passes a valid name', () => {
    const holder = plainToInstance(NameHolder, { name: 'Handbook' });
    expect(validateSync(holder)).toHaveLength(0);
  });

  it('reports an invalid name with a descriptive message', () => {
    const holder = plainToInstance(NameHolder, { name: '../x' });
    const [error] = validateSync(holder);
    expect(error.property).toBe('name');
    expect(Object.values(error.constraints ?? {})[0]).toContain(
      'must not be a reserved name',
    );
  });
});
