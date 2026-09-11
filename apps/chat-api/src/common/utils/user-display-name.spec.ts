import { describe, expect, it } from 'vitest';
import { getUserDisplayName, resolveDisplayAuthor } from './user-display-name';

describe('getUserDisplayName', () => {
  it('prefers the name claim', () => {
    expect(
      getUserDisplayName({ name: 'Test User', email: 'v.d@example.com' }),
    ).toBe('Test User');
  });

  it('falls back to preferred_username when name is absent', () => {
    expect(
      getUserDisplayName({
        preferred_username: 'valery.d',
        email: 'v.d@example.com',
      }),
    ).toBe('valery.d');
  });

  it('falls back to the local part of email when name and preferred_username are absent', () => {
    expect(getUserDisplayName({ email: 'palina@example.com' })).toBe('palina');
  });

  it('returns the raw value when email has no local part separator', () => {
    expect(getUserDisplayName({ email: 'not-an-email' })).toBe('not-an-email');
  });

  it('falls back to "Unknown Author" when no usable claim is present', () => {
    expect(getUserDisplayName({})).toBe('Unknown Author');
  });

  it('ignores blank string claims and falls through to the next source', () => {
    expect(
      getUserDisplayName({ name: '   ', email: 'palina@example.com' }),
    ).toBe('palina');
  });
});

describe('resolveDisplayAuthor', () => {
  const claims = { name: 'Daniil Pavlov' };

  it('uses the submitted author when one is supplied', () => {
    expect(resolveDisplayAuthor('DIAL Team', claims)).toBe('DIAL Team');
  });

  it('trims the submitted author', () => {
    expect(resolveDisplayAuthor('  DIAL Team  ', claims)).toBe('DIAL Team');
  });

  it('falls back to the session display name when the author is omitted', () => {
    expect(resolveDisplayAuthor(undefined, claims)).toBe('Daniil Pavlov');
  });

  it('falls back to the session display name when the author is blank', () => {
    expect(resolveDisplayAuthor('   ', claims)).toBe('Daniil Pavlov');
  });

  it('falls back to the session display name when the author is an empty string', () => {
    expect(resolveDisplayAuthor('', claims)).toBe('Daniil Pavlov');
  });

  it('never yields an empty display author, even with no usable claims', () => {
    expect(resolveDisplayAuthor('  ', {})).toBe('Unknown Author');
  });
});
