import { UsageI18nKeys } from '../constants/translation-keys';

/**
 * A DIAL Core `resetsAt` instant, normalized into the preformatted strings the
 * usage dashboard renders. Every `Date` and `Intl` call for reset times lives
 * in this module: `@epam/ai-dial-usage-dashboard` receives only these strings
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

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Formats DIAL Core's `resetsAt` for display in the viewer's locale and
 * timezone, always stating the zone so a UTC boundary shown in local time is
 * never ambiguous.
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

    const boundary = new Date(resetsAtMs);
    const zoneOverride = timeZone ? { timeZone } : {};
    const dateTimeParts = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    } as const;

    const dateTime = new Intl.DateTimeFormat(activeLocale, {
      ...dateTimeParts,
      timeZoneName: 'shortOffset',
      ...zoneOverride,
    }).format(boundary);

    /*
     * The spoken form names the zone in full ('Central European Summer Time'
     * rather than 'GMT+2'), which is the only thing it adds over the visible
     * line — a screen reader reading out an offset abbreviation is far less
     * useful than the zone's name.
     */
    const spokenDateTime = new Intl.DateTimeFormat(activeLocale, {
      ...dateTimeParts,
      timeZoneName: 'long',
      ...zoneOverride,
    }).format(boundary);

    return {
      resetsAtMs,
      isoValue: resetsAt,
      label: t(UsageI18nKeys.ResetsAtLabel, { dateTime }),
      ariaLabel: t(UsageI18nKeys.ResetsAtAriaLabel, {
        dateTime: spokenDateTime,
      }),
    };
  } catch {
    return undefined;
  }
};
