import { describe, expect, it } from 'vitest';
import {
  getUserDisplayName,
  readPublicationDisplayAuthor,
  resolveDisplayAuthor,
} from './user-display-name';

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

  it.each([
    [
      'uses the submitted author when one is supplied',
      { author: 'DIAL Team', expected: 'DIAL Team' },
    ],
    [
      'trims the submitted author',
      { author: '  DIAL Team  ', expected: 'DIAL Team' },
    ],
    [
      'falls back to the session display name when the author is blank',
      { author: '   ', expected: 'Daniil Pavlov' },
    ],
    [
      'falls back to the session display name when the author is an empty string',
      { author: '', expected: 'Daniil Pavlov' },
    ],
  ])('%s', (_name, { author, expected }) => {
    expect(resolveDisplayAuthor(author, claims)).toBe(expected);
  });

  it('falls back to the session display name when the author is omitted', () => {
    expect(resolveDisplayAuthor(undefined, claims)).toBe('Daniil Pavlov');
  });

  it('never yields an empty display author, even with no usable claims', () => {
    expect(resolveDisplayAuthor('  ', {})).toBe('Unknown Author');
  });
});

describe('readPublicationDisplayAuthor', () => {
  it.each([
    [
      'prefers the submitted display author over the account Core recorded',
      {
        publication: {
          author: 'daniil@example.com',
          displayAuthor: 'DIAL Team',
        },
        expected: 'DIAL Team',
      },
    ],
    [
      'falls back to the recorded account when no display author was submitted',
      {
        publication: { author: 'daniil@example.com' },
        expected: 'daniil@example.com',
      },
    ],
    /* Core stores an omitted display author as `''`, not as a missing key. */
    [
      'treats an empty display author as unset',
      {
        publication: { author: 'daniil@example.com', displayAuthor: '' },
        expected: 'daniil@example.com',
      },
    ],
    [
      'treats a whitespace-only display author as unset',
      {
        publication: { author: 'daniil@example.com', displayAuthor: '   ' },
        expected: 'daniil@example.com',
      },
    ],
  ])('%s', (_name, { publication, expected }) => {
    expect(readPublicationDisplayAuthor(publication, 'fallback')).toBe(
      expected,
    );
  });

  it('trims the display author it returns', () => {
    expect(
      readPublicationDisplayAuthor({ displayAuthor: '  DIAL Team  ' }, ''),
    ).toBe('DIAL Team');
  });

  it('uses the fallback when the publication carries neither identity', () => {
    expect(readPublicationDisplayAuthor({}, 'DIAL Team')).toBe('DIAL Team');
  });

  it('uses the fallback when Core returned no publication body at all', () => {
    expect(readPublicationDisplayAuthor(undefined, 'DIAL Team')).toBe(
      'DIAL Team',
    );
  });
});
