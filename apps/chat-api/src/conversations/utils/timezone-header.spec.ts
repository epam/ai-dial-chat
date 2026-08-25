import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertValidOptionalTimezone,
  TIMEZONE_MAX_LENGTH,
} from './timezone-header';

describe('assertValidOptionalTimezone', () => {
  it.each(['UTC', 'Europe/Warsaw', 'America/New_York', 'Etc/GMT+5'])(
    'returns supported timezone %s unchanged',
    (timezone) => {
      expect(assertValidOptionalTimezone(timezone)).toBe(timezone);
    },
  );

  it('accepts an omitted timezone', () => {
    expect(assertValidOptionalTimezone(undefined)).toBeUndefined();
  });

  it.each([
    '',
    'Europe Warsaw',
    'Europe//Warsaw',
    'Europe/Warsaw\nInjected',
    'Mars/Olympus',
    'A'.repeat(TIMEZONE_MAX_LENGTH + 1),
  ])('rejects invalid timezone %j', (timezone) => {
    expect(() => assertValidOptionalTimezone(timezone)).toThrow(
      BadRequestException,
    );
  });

  it('rejects multiple timezone header values', () => {
    expect(() =>
      assertValidOptionalTimezone(['Europe/Warsaw', 'Asia/Tokyo']),
    ).toThrow(BadRequestException);
  });
});
