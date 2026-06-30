import { describe, expect, it } from 'vitest';
import { extractInitials } from '../initials';

describe('extractInitials', () => {
  it('returns two uppercase initials for a multi-word name', () => {
    expect(extractInitials('My Application')).toBe('MA');
  });

  it('returns first two chars for a single-word name', () => {
    expect(extractInitials('Summarizer')).toBe('SU');
  });

  it('returns "?" for an empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  it('normalises extra whitespace', () => {
    expect(extractInitials('  Hello   World  ')).toBe('HW');
  });

  it('returns one character for a single-char name', () => {
    expect(extractInitials('X')).toBe('X');
  });

  it('uses only the first two words when three or more are present', () => {
    expect(extractInitials('One Two Three')).toBe('OT');
  });

  it('skips leading punctuation such as "[" in each word', () => {
    expect(extractInitials('[StatGPT] Global Trusted')).toBe('SG');
  });

  it('strips brackets from a single-word name', () => {
    expect(extractInitials('[App]')).toBe('AP');
  });
});
