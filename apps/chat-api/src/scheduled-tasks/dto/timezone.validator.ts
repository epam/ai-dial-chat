import { registerDecorator, type ValidationOptions } from 'class-validator';

/*
 * Allowlist of IANA identifier characters; nothing path-, URL- or log-hostile
 * gets through. It must start with a letter because engines also accept
 * offset zones (`+02`, `+02:00`), which DIAL Scheduler rejects.
 */
export const TIMEZONE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_+\-/]*$/;

export const TIMEZONE_ID_MAX_LENGTH = 64;

/**
 * True when the platform's `Intl` can build a formatter for the identifier.
 * `Intl` ignores case, so a wrongly cased name passes here and is rejected by
 * DIAL Scheduler, which is case-sensitive.
 */
export const isKnownTimezone = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > TIMEZONE_ID_MAX_LENGTH ||
    !TIMEZONE_ID_PATTERN.test(value)
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Accepts an IANA time zone identifier such as `Europe/Berlin` (offsets like `+02:00` are rejected). */
export const IsIanaTimezone = (options?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isKnownTimezone(value),
        defaultMessage: () =>
          'timezone must be an IANA time zone identifier such as Europe/Berlin',
      },
    });
  };
};
