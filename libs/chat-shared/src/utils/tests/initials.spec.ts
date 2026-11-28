import { describe, expect, it } from 'vitest';
import { extractInitials } from '../initials';

describe('extractInitials', () => {
  it.each([
    [
      'returns two uppercase initials for a multi-word name',
      { input: 'My Application', expected: 'MA' },
    ],
    [
      'returns first two chars for a single-word name',
      { input: 'Summarizer', expected: 'SU' },
    ],
    ['returns "?" for an empty string', { input: '', expected: '?' }],
    [
      'normalises extra whitespace',
      { input: '  Hello   World  ', expected: 'HW' },
    ],
    [
      'returns one character for a single-char name',
      { input: 'X', expected: 'X' },
    ],
    [
      'uses only the first two words when three or more are present',
      { input: 'One Two Three', expected: 'OT' },
    ],
    [
      'skips leading punctuation such as "[" in each word',
      { input: '[StatGPT] Global Trusted', expected: 'SG' },
    ],
    [
      'strips brackets from a single-word name',
      { input: '[App]', expected: 'AP' },
    ],
  ])('%s', (_name, { input, expected }) => {
    expect(extractInitials(input)).toBe(expected);
  });
});
