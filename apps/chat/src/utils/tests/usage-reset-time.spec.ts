import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageI18nKeys } from '../../constants/translation-keys';
import { formatUsageResetTime } from '../usage-reset-time';

/*
 * Boundary values taken from the real GET /api/v1/user/usage capture in
 * openspec/changes/migrate-usage-reset-times/fixtures/.
 */
const DAY_BOUNDARY = '2026-09-16T00:00:00Z';
const MONTH_BOUNDARY = '2026-10-01T00:00:00Z';

/* Mirrors the en.json values for usage.resetsAtLabel / usage.resetsAtAriaLabel. */
const t = (key: string, options?: Record<string, unknown>): string => {
  const dateTime = String(options?.dateTime ?? '');
  if (key === UsageI18nKeys.ResetsAtAriaLabel) {
    return `Usage resets ${dateTime}`;
  }
  return `Resets ${dateTime}`;
};

/*
 * The formatter resolves the viewer's zone with a zero-argument
 * Intl.DateTimeFormat() and passes the result back in as an explicit
 * timeZone, so stubbing only that resolution call is enough to place a test in
 * a chosen zone while the real formatter does the formatting.
 */
const OriginalDateTimeFormat = Intl.DateTimeFormat;

const mockResolvedZone = (timeZone: string): void => {
  /*
   * A `function` expression rather than an arrow: the formatter calls
   * `new Intl.DateTimeFormat(...)`, and Vitest can only make a mock newable
   * when its implementation is written as a function or a class.
   */
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    if (locales === undefined && options === undefined) {
      return { resolvedOptions: () => ({ timeZone }) };
    }
    return new OriginalDateTimeFormat(locales, options);
  } as unknown as typeof Intl.DateTimeFormat);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatUsageResetTime', () => {
  it('renders a UTC boundary at the local wall-clock time of the viewer zone', () => {
    mockResolvedZone('Europe/Warsaw');

    const display = formatUsageResetTime(DAY_BOUNDARY, 'en-US', t);

    /* 16 Sep 2026 is CEST (UTC+2), so UTC midnight is 02:00 local. */
    expect(display?.label).toBe('Resets Sep 16, 2026, 2:00 AM GMT+2');
  });

  it('names the timezone in full in the spoken form, not as an offset', () => {
    mockResolvedZone('Europe/Warsaw');

    const display = formatUsageResetTime(DAY_BOUNDARY, 'en-US', t);

    expect(display?.ariaLabel).toBe(
      'Usage resets Sep 16, 2026, 2:00 AM Central European Summer Time',
    );
    expect(display?.ariaLabel).not.toContain('GMT+');
    /* The spoken form must add something the visible line does not. */
    expect(display?.ariaLabel).not.toContain(display?.label ?? '');
  });

  it('gives the same instant different labels in different zones but one resetsAtMs', () => {
    mockResolvedZone('Europe/Warsaw');
    const warsaw = formatUsageResetTime(DAY_BOUNDARY, 'en-US', t);

    vi.restoreAllMocks();
    mockResolvedZone('Asia/Tokyo');
    const tokyo = formatUsageResetTime(DAY_BOUNDARY, 'en-US', t);

    expect(warsaw?.label).toBe('Resets Sep 16, 2026, 2:00 AM GMT+2');
    expect(tokyo?.label).toBe('Resets Sep 16, 2026, 9:00 AM GMT+9');
    expect(warsaw?.label).not.toBe(tokyo?.label);
    expect(warsaw?.resetsAtMs).toBe(Date.parse(DAY_BOUNDARY));
    expect(tokyo?.resetsAtMs).toBe(warsaw?.resetsAtMs);
  });

  it('always states a timezone designator in the visible label', () => {
    for (const timeZone of [
      'Europe/Warsaw',
      'Asia/Tokyo',
      'UTC',
      'America/New_York',
    ]) {
      vi.restoreAllMocks();
      mockResolvedZone(timeZone);

      const display = formatUsageResetTime(MONTH_BOUNDARY, 'en-US', t);

      expect(display?.label).toMatch(/GMT([+-]\d{1,2})?|UTC/);
    }
  });

  it('echoes the input verbatim as isoValue', () => {
    mockResolvedZone('Asia/Tokyo');

    expect(formatUsageResetTime(DAY_BOUNDARY, 'en-US', t)?.isoValue).toBe(
      DAY_BOUNDARY,
    );
    expect(formatUsageResetTime(MONTH_BOUNDARY, 'en-US', t)?.isoValue).toBe(
      MONTH_BOUNDARY,
    );
  });

  it('returns undefined for an absent, empty, or unparseable value', () => {
    mockResolvedZone('Europe/Warsaw');

    expect(formatUsageResetTime(undefined, 'en-US', t)).toBeUndefined();
    expect(formatUsageResetTime('', 'en-US', t)).toBeUndefined();
    expect(formatUsageResetTime('not-a-date', 'en-US', t)).toBeUndefined();
  });

  it('returns undefined when Intl.DateTimeFormat throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function () {
      throw new TypeError('Intl unavailable in this runtime');
    } as unknown as typeof Intl.DateTimeFormat);

    expect(formatUsageResetTime(DAY_BOUNDARY, 'en-US', t)).toBeUndefined();
  });
});
