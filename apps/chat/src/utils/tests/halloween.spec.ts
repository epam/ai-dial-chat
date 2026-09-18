import { describe, expect, it } from 'vitest';
import { isHalloweenSecretPhrase } from '../halloween';

describe('isHalloweenSecretPhrase', () => {
  it('matches the phrase regardless of case, punctuation, and padding', () => {
    expect(isHalloweenSecretPhrase('trick or treat')).toBe(true);
    expect(isHalloweenSecretPhrase('  Trick Or Treat!  ')).toBe(true);
    expect(isHalloweenSecretPhrase('trick-or-treat')).toBe(true);
    expect(isHalloweenSecretPhrase('TRICK   OR   TREAT???')).toBe(true);
  });

  it('does not match a message that merely contains the phrase', () => {
    expect(
      isHalloweenSecretPhrase('what does trick or treat mean in Belarus?'),
    ).toBe(false);
    expect(isHalloweenSecretPhrase('trick or treats')).toBe(false);
  });

  it('does not match unrelated or empty input', () => {
    expect(isHalloweenSecretPhrase('')).toBe(false);
    expect(isHalloweenSecretPhrase('   ')).toBe(false);
    expect(isHalloweenSecretPhrase('treat or trick')).toBe(false);
  });
});
