import { describe, expect, it } from 'vitest';
import { getUserDisplayName } from './user-display-name';

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
