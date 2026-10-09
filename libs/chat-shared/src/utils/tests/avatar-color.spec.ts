import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, pickAvatarColor } from '../avatar-color';

describe('AVATAR_COLORS', () => {
  it('exposes every palette entry as a named color', () => {
    const named = Object.values(AVATAR_COLORS);
    expect(named).toHaveLength(7);
    /*
     * Single characters 'a'–'g' hit every palette index exactly once
     * (97–103 mod 7 = 6,0,1,2,3,4,5), so their picks cover the whole
     * palette — every hashed pick must be reachable by name.
     */
    for (const char of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      expect(named).toContainEqual(pickAvatarColor(char));
    }
    expect(AVATAR_COLORS.blue.background).toContain('--bg-visual-blue');
  });
});

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
