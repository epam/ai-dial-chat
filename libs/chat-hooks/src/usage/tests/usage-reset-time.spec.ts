import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsagePeriod } from '../usage-period';
import {
  UsageResetOffsetPolicy,
  USAGE_RESET_I18N_KEYS,
  formatUsageResetShort,
  formatUsageResetTime,
} from '../usage-reset-time';

/*
 * Boundary values taken from the real GET /api/v1/user/usage capture in
 * openspec/changes/archive/2026-09-15-migrate-usage-reset-times/fixtures/.
 */
const DAY_BOUNDARY = '2026-09-16T00:00:00Z';
const MONTH_BOUNDARY = '2026-10-01T00:00:00Z';

/* Mirrors the en.json values for usage.resetsAtLabel / usage.resetsAtAriaLabel. */
const t = (key: string, options?: Record<string, unknown>): string => {
  const dateTime = String(options?.dateTime ?? '');
  if (key === USAGE_RESET_I18N_KEYS.resetsAtAriaLabel) {
    return `Usage resets ${dateTime}`;
  }
  /* Mirrors conversationInput.usageBanner.resetsAtTime / resetsOnDate. */
  if (key === USAGE_RESET_I18N_KEYS.resetsAtTime) {
    return `Resets at ${String(options?.time)}.`;
  }
  if (key === USAGE_RESET_I18N_KEYS.resetsOnDate) {
    return `Resets on ${String(options?.date)}.`;
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
  /* The label is stated at the viewer's offset as it is now, so pin now. */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('states every boundary at the current offset across a daylight saving switch', () => {
    mockResolvedZone('Europe/Warsaw');
    vi.setSystemTime(new Date('2026-10-24T22:30:00Z'));

    /* CEST (UTC+2) now; the week boundary falls after the switch to CET. */
    const day = formatUsageResetTime('2026-10-25T00:00:00Z', 'en-US', t);
    const week = formatUsageResetTime('2026-10-26T00:00:00Z', 'en-US', t);

    expect(day?.label).toBe('Resets Oct 25, 2026, 2:00 AM GMT+2');
    expect(week?.label).toBe('Resets Oct 26, 2026, 2:00 AM GMT+2');
    expect(week?.ariaLabel).toBe(
      'Usage resets Oct 26, 2026, 2:00 AM Central European Summer Time',
    );
    expect(week?.resetsAtMs).toBe(Date.parse('2026-10-26T00:00:00Z'));
  });

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

describe('formatUsageResetShort', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a daily boundary as a time with its zone offset', () => {
    mockResolvedZone('Europe/Istanbul');

    const display = formatUsageResetShort(
      '2026-10-13T00:00:00Z',
      UsagePeriod.Day,
      'en',
      t,
    );

    expect(display).toEqual({
      isoValue: '2026-10-13T00:00:00Z',
      label: 'Resets at 3:00 AM GMT+3.',
      ariaLabel: expect.stringMatching(/^Usage resets Oct 13, 2026/),
    });
  });

  it('renders a monthly boundary as a short date without the current year', () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T12:00:00Z') });
    mockResolvedZone('UTC');

    expect(
      formatUsageResetShort('2026-11-01T00:00:00Z', UsagePeriod.Month, 'en', t)
        ?.label,
    ).toBe('Resets on Nov 1.');
  });

  it('includes the year when the boundary falls in another year', () => {
    vi.useFakeTimers({ now: new Date('2026-12-20T12:00:00Z') });
    mockResolvedZone('UTC');

    expect(
      formatUsageResetShort('2027-01-01T00:00:00Z', UsagePeriod.Week, 'en', t)
        ?.label,
    ).toBe('Resets on Jan 1, 2027.');
  });

  it.each([undefined, '', 'not-a-date'])(
    'returns undefined for the resetsAt value %j',
    (resetsAt) => {
      expect(
        formatUsageResetShort(resetsAt, UsagePeriod.Day, 'en', t),
      ).toBeUndefined();
    },
  );

  it('returns undefined when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('Incomplete Intl');
    });

    expect(
      formatUsageResetShort(MONTH_BOUNDARY, UsagePeriod.Month, 'en', t),
    ).toBeUndefined();
  });
});

describe('reset offset policy', () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    ['2026-10-24T22:30:00Z', '2026-10-26T00:00:00Z', 'GMT+2', 'GMT+1'],
    ['2026-03-28T12:00:00Z', '2026-03-30T00:00:00Z', 'GMT+1', 'GMT+2'],
  ])(
    'keeps the same boundary across DST from %s',
    (now, boundary, current, reset) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(now));
      mockResolvedZone('Europe/Warsaw');
      const legacy = formatUsageResetTime(boundary, 'en-US', t);
      const explicit = formatUsageResetTime(boundary, 'en-US', t, {
        offsetPolicy: UsageResetOffsetPolicy.CurrentOffset,
      });
      const actual = formatUsageResetTime(boundary, 'en-US', t, {
        offsetPolicy: UsageResetOffsetPolicy.ResetInstant,
      });
      expect(explicit).toEqual(legacy);
      expect(legacy?.label).toContain(current);
      expect(actual?.label).toContain(reset);
      expect(actual?.isoValue).toBe(boundary);
      expect(actual?.resetsAtMs).toBe(Date.parse(boundary));
    },
  );
  it.each(Object.values(UsageResetOffsetPolicy))(
    'returns undefined on invalid inputs and Intl failures with %s',
    (offsetPolicy) => {
      expect(
        formatUsageResetTime('bad', 'en-US', t, { offsetPolicy }),
      ).toBeUndefined();
      mockResolvedZone('not-a-zone');
      expect(
        formatUsageResetTime(DAY_BOUNDARY, 'en-US', t, { offsetPolicy }),
      ).toBeUndefined();
    },
  );
});
