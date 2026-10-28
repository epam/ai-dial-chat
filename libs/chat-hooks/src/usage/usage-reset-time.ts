import { UsagePeriod } from './usage-period';

/**
 * i18n key strings the consuming app's translation bundle must define for the
 * reset-time formatters to produce translated strings. The values are the
 * default key paths used by AI DIAL Chat.
 */
export const USAGE_RESET_I18N_KEYS = {
  /** Visible label for a full reset time. Receives `{ dateTime: string }`. */
  resetsAtLabel: 'usage.resetsAtLabel',
  /** Spoken label for a full reset time. Receives `{ dateTime: string }`. */
  resetsAtAriaLabel: 'usage.resetsAtAriaLabel',
  /** Short daily reset sentence. Receives `{ time: string }`. */
  resetsAtTime: 'conversationInput.usageBanner.resetsAtTime',
  /** Short weekly/monthly reset sentence. Receives `{ date: string }`. */
  resetsOnDate: 'conversationInput.usageBanner.resetsOnDate',
} as const;

/**
 * A DIAL Core `resetsAt` instant, normalized into the preformatted strings the
 * usage dashboard renders. Every `Date` and `Intl` call for reset times lives
 * in this module: the display components receive only these strings
 * and never sees a raw timestamp, a locale, or a timezone.
 */
export interface ResetTimeDisplay {
  /** Exclusive end of the period, as an epoch ms value, for boundary scheduling. */
  resetsAtMs: number;
  /** Machine-readable instant for a `<time dateTime>` attribute, e.g. '2026-09-16T00:00:00Z'. */
  isoValue: string;
  /** Visible label, e.g. 'Resets 16 Sept 2026, 03:00 GMT+3'. */
  label: string;
  /** Accessible expansion naming the timezone in full, e.g. 'Usage resets Sep 16, 2026 at 2:00 AM Central European Summer Time'. */
  ariaLabel: string;
}

/** A translate function compatible with i18next's `TFunction`. */
export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

const DATE_TIME_PARTS = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const;

const OFFSET_PATTERN = /GMT([+-])(\d{2}):(\d{2})/;
/* V8's `format()` turns U+202F into a plain space for web compatibility; `formatToParts()` does not. */
const NARROW_NO_BREAK_SPACE = new RegExp('\\u202f', 'g');

interface ZoneOverride {
  timeZone?: string;
}

/* The viewer zone's UTC offset at `now`, in minutes; 'GMT' alone is UTC. */
const getOffsetMinutes = (now: Date, zoneOverride: ZoneOverride): number => {
  const zoneName = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'longOffset',
    ...zoneOverride,
  })
    .formatToParts(now)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = OFFSET_PATTERN.exec(zoneName ?? '');
  if (match == null) {
    return 0;
  }
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

/*
 * Formats an instant at the viewer's current offset: the instant is shifted by
 * that offset and formatted as UTC, and the UTC zone name is swapped for the
 * viewer's own as it reads at `now`. The locale still orders every part.
 */
const formatInCurrentOffset = (
  instantMs: number,
  now: Date,
  activeLocale: string,
  timeZoneName: 'shortOffset' | 'long',
  zoneOverride: ZoneOverride,
): string => {
  const currentZoneName =
    new Intl.DateTimeFormat(activeLocale, { timeZoneName, ...zoneOverride })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  const shifted = new Date(
    instantMs + getOffsetMinutes(now, zoneOverride) * 60_000,
  );

  return new Intl.DateTimeFormat(activeLocale, {
    ...DATE_TIME_PARTS,
    timeZoneName,
    timeZone: 'UTC',
  })
    .formatToParts(shifted)
    .map((part) =>
      part.type === 'timeZoneName' ? currentZoneName : part.value,
    )
    .join('')
    .replace(NARROW_NO_BREAK_SPACE, ' ');
};

/**
 * Formats DIAL Core's `resetsAt` for display in the viewer's locale and
 * timezone, at the viewer's current UTC offset, always stating that offset so
 * a UTC boundary shown in local time is never ambiguous.
 *
 * Returns `undefined` on every failure path — an absent, empty, or
 * unparseable value, or an `Intl` implementation that throws (embedded and
 * restricted runtimes expose incomplete ones, which is why the resolution is
 * wrapped, matching `getBrowserTimezone` in `@epam/ai-dial-chat-hooks`). A
 * reset time is decoration on a usage figure and never a gate on it, so the
 * caller renders the rest of the card unchanged when this returns nothing.
 *
 * The boundary is never derived from the browser's own calendar — no local
 * midnight, no start-of-week, no arithmetic on `new Date()`.
 */
export const formatUsageResetTime = (
  resetsAt: string | undefined,
  activeLocale: string,
  t: TranslateFn,
): ResetTimeDisplay | undefined => {
  if (!resetsAt) {
    return undefined;
  }

  const resetsAtMs = Date.parse(resetsAt);
  if (Number.isNaN(resetsAtMs)) {
    return undefined;
  }

  try {
    /*
     * Resolving the viewer's zone explicitly surfaces an incomplete Intl
     * implementation before any formatting work; `timeZoneName: 'shortOffset'`
     * is what puts the designator into the visible label.
     *
     * The components are named individually rather than through
     * `dateStyle`/`timeStyle` because ECMA-402 forbids combining either style
     * shorthand with `timeZoneName` — that combination throws a TypeError at
     * construction. These options reproduce a medium date and a short time
     * while still carrying the offset.
     */
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zoneOverride = timeZone ? { timeZone } : {};
    const now = new Date();

    /*
     * Every reset time is stated in the viewer's offset as it is now, so the
     * day, week and month headers never mix two offsets across a daylight
     * saving switch (a Sunday boundary in GMT+2, the next one in GMT+1).
     */
    const dateTime = formatInCurrentOffset(
      resetsAtMs,
      now,
      activeLocale,
      'shortOffset',
      zoneOverride,
    );

    /*
     * The spoken form names the zone in full ('Central European Summer Time'
     * rather than 'GMT+2'), which is the only thing it adds over the visible
     * line — a screen reader reading out an offset abbreviation is far less
     * useful than the zone's name.
     */
    const spokenDateTime = formatInCurrentOffset(
      resetsAtMs,
      now,
      activeLocale,
      'long',
      zoneOverride,
    );

    return {
      resetsAtMs,
      isoValue: resetsAt,
      label: t(USAGE_RESET_I18N_KEYS.resetsAtLabel, { dateTime }),
      ariaLabel: t(USAGE_RESET_I18N_KEYS.resetsAtAriaLabel, {
        dateTime: spokenDateTime,
      }),
    };
  } catch {
    return undefined;
  }
};

/** A `resetsAt` instant as the one-sentence reset notice the composer usage banner renders. */
export interface ShortResetTimeDisplay {
  /** Machine-readable instant for a `<time dateTime>` attribute, e.g. '2026-10-13T00:00:00Z'. */
  isoValue: string;
  /** Visible sentence, e.g. 'Resets at 3:00 AM GMT+3.' or 'Resets on Oct 19.'. */
  label: string;
  /** Accessible expansion with the full date, time and zone name, from `formatUsageResetTime`. */
  ariaLabel: string;
}

/**
 * Formats DIAL Core's `resetsAt` as the banner's reset sentence: a time with
 * its zone offset for a daily period, a short date (with the year only when it
 * is not the current one) for a weekly or monthly period.
 *
 * Returns `undefined` on the same failure paths as `formatUsageResetTime`,
 * whose spoken form it reuses, so the caller renders the period sentence alone.
 */
export const formatUsageResetShort = (
  resetsAt: string | undefined,
  period: UsagePeriod,
  activeLocale: string,
  t: TranslateFn,
): ShortResetTimeDisplay | undefined => {
  const full = formatUsageResetTime(resetsAt, activeLocale, t);
  if (full == null) {
    return undefined;
  }

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zoneOverride = timeZone ? { timeZone } : {};
    const boundary = new Date(full.resetsAtMs);

    if (period === UsagePeriod.Day) {
      const time = new Intl.DateTimeFormat(activeLocale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'shortOffset',
        ...zoneOverride,
      }).format(boundary);

      return {
        isoValue: full.isoValue,
        label: t(USAGE_RESET_I18N_KEYS.resetsAtTime, { time }),
        ariaLabel: full.ariaLabel,
      };
    }

    // Compared in the viewer's zone, the same one the date is shown in.
    const yearFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      ...zoneOverride,
    });
    const isOtherYear =
      yearFormatter.format(boundary) !== yearFormatter.format(new Date());

    const date = new Intl.DateTimeFormat(activeLocale, {
      month: 'short',
      day: 'numeric',
      ...(isOtherYear ? { year: 'numeric' } : {}),
      ...zoneOverride,
    }).format(boundary);

    return {
      isoValue: full.isoValue,
      label: t(USAGE_RESET_I18N_KEYS.resetsOnDate, { date }),
      ariaLabel: full.ariaLabel,
    };
  } catch {
    return undefined;
  }
};
