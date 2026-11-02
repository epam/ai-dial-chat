import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  hasAtMostCodePoints,
  MaxCodePoints,
} from './max-code-points.validator';

class TextHolder {
  @MaxCodePoints(3)
  text!: string;
}

describe('hasAtMostCodePoints', () => {
  it('counts an astral character as one code point', () => {
    // Three emoji are six UTF-16 code units but three code points.
    expect(hasAtMostCodePoints('😀😀😀', 3)).toBe(true);
    expect(hasAtMostCodePoints('😀😀😀😀', 3)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(hasAtMostCodePoints(42, 3)).toBe(false);
  });
});

describe('MaxCodePoints', () => {
  it('passes text at the limit', () => {
    expect(
      validateSync(plainToInstance(TextHolder, { text: 'abc' })),
    ).toHaveLength(0);
  });

  it('reports text over the limit', () => {
    const [error] = validateSync(plainToInstance(TextHolder, { text: 'abcd' }));
    expect(error.constraints).toEqual({
      maxCodePoints: 'text must be a string of at most 3 characters',
    });
  });
});
