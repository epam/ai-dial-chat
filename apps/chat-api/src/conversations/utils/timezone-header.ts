import { BadRequestException } from '@nestjs/common';

export const TIMEZONE_HEADER = 'X-Timezone';
export const TIMEZONE_MAX_LENGTH = 255;
export const TIMEZONE_PATTERN = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;

const isSupportedTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates optional request-scoped timezone context before it can reach an
 * upstream header. The original value is preserved for DIAL Core forwarding.
 */
export const assertValidOptionalTimezone = (
  timezone: string | string[] | undefined,
): string | undefined => {
  if (timezone === undefined) return undefined;

  if (
    typeof timezone !== 'string' ||
    timezone.length > TIMEZONE_MAX_LENGTH ||
    !TIMEZONE_PATTERN.test(timezone) ||
    !isSupportedTimezone(timezone)
  ) {
    throw new BadRequestException(`${TIMEZONE_HEADER} header is invalid`);
  }

  return timezone;
};
