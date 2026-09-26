import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchesCelebrationPhrase, pickCelebrationScene } from '../celebration';

describe('event secret phrases', () => {
  it.each([
    ['Trick-or-Treat!', 'trick or treat'],
    ['  С НОВЫМ ГОДОМ! ', 'с новым годом'],
    ['عام جديد سعيد!', 'عام جديد سعيد'],
    ['Happy   New Year', 'happy new year'],
  ])('matches a whole phrase in its own writing system: %s', (text, phrase) => {
    expect(matchesCelebrationPhrase(text, [phrase])).toBe(true);
  });

  it('does not consume empty, punctuation-only, missing or partial phrases', () => {
    expect(matchesCelebrationPhrase('', [''])).toBe(false);
    expect(matchesCelebrationPhrase('!!!', ['?'])).toBe(false);
    expect(
      matchesCelebrationPhrase('please say trick or treat', ['trick or treat']),
    ).toBe(false);
    expect(matchesCelebrationPhrase('happy new year', [])).toBe(false);
    expect(matchesCelebrationPhrase('عام آخر', ['عام جديد'])).toBe(false);
  });
});

describe('event scene selection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('can start with every registered click scene', () => {
    const ids = ['web', 'ghosts', 'witches'];
    const random = vi.spyOn(Math, 'random');
    const selected = ids.map((_, index) => {
      random.mockReturnValue((index + 0.5) / ids.length);
      return pickCelebrationScene(ids);
    });
    expect(new Set(selected)).toEqual(new Set(ids));
  });

  it('excludes the last scene while allowing every alternative', () => {
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0);
    expect(pickCelebrationScene(['a', 'b', 'c'], 'b')).toBe('a');
    random.mockReturnValue(0.99);
    expect(pickCelebrationScene(['a', 'b', 'c'], 'b')).toBe('c');
  });

  it('handles empty pools and a single scene without stalling', () => {
    expect(pickCelebrationScene([])).toBeUndefined();
    expect(pickCelebrationScene(['snow'], 'snow')).toBe('snow');
    expect(pickCelebrationScene(['snow', 'snow'], 'snow')).toBe('snow');
  });
});
