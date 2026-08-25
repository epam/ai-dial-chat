import { describe, expect, it } from 'vitest';
import { pickAvatarColor } from '../avatar-color';

describe('pickAvatarColor', () => {
  it('returns the same entry for the same name (deterministic)', () => {
    expect(pickAvatarColor('My App')).toEqual(pickAvatarColor('My App'));
  });

  it('returns a valid entry for an empty string without throwing', () => {
    const result = pickAvatarColor('');
    expect(result).toHaveProperty('background');
    expect(result).toHaveProperty('foreground');
    expect(result.background).toMatch(/^var\(--[a-z0-9-]+, #[0-9a-f]{6}\)$/i);
    expect(result.foreground).toMatch(/^var\(--[a-z0-9-]+, #[0-9a-f]{6}\)$/i);
  });

  it('palette contains more than one distinct entry', () => {
    const results = new Set(
      [
        'Alpha',
        'Beta',
        'Gamma',
        'Delta',
        'Epsilon',
        'Zeta',
        'Eta',
        'Theta',
      ].map((n) => pickAvatarColor(n).background),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
