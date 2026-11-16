import type { ScheduledTaskTimezoneOption } from '@epam/ai-dial-scheduled-tasks';

/** Zone every task falls back to and the one engines may leave out of their supported list. */
export const UTC_TIMEZONE_ID = 'UTC';

/*
 * Engines such as V8 list legacy names (`Asia/Calcutta`) where the tz database
 * now says `Asia/Kolkata`. The picker shows the current name; DIAL Scheduler
 * accepts both, and a task saved with the legacy name still resolves to the
 * current row through `findTimezoneOption`.
 */
const LEGACY_TIMEZONE_RENAMES: Readonly<Record<string, string>> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Louisville': 'America/Kentucky/Louisville',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

const OFFSET_PATTERN = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/;
const LETTERS_ONLY_PATTERN = /^[A-Za-z]{2,6}$/;
const MINUTES_PER_HOUR = 60;

/** Options of {@link getTimezoneOptions}. */
export interface GetTimezoneOptionsParams {
  /** Moment the offsets and the current abbreviation are read at. Defaults to now. */
  now?: Date;
  /** BCP 47 locale the abbreviations are written in. Defaults to the platform default. */
  locale?: string;
}

const readZoneName = (
  timezone: string,
  timeZoneName: 'longOffset' | 'short' | 'long' | 'longGeneric',
  at: Date,
  locale: string | undefined,
): string | undefined => {
  try {
    return new Intl.DateTimeFormat(locale ?? 'en-US', {
      timeZone: timezone,
      timeZoneName,
    })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')
      ?.value.replace('−', '-');
  } catch {
    return undefined;
  }
};

const parseOffsetMinutes = (longOffset: string | undefined): number => {
  const match = OFFSET_PATTERN.exec(longOffset ?? '');
  if (!match?.[1]) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * MINUTES_PER_HOUR + Number(match[3] ?? 0));
};

const pad = (value: number): string => String(value).padStart(2, '0');

const formatOffsetLabel = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  return `GMT${sign}${pad(Math.floor(absolute / MINUTES_PER_HOUR))}:${pad(absolute % MINUTES_PER_HOUR)}`;
};

/** The platform's zone list, always containing `UTC`; empty of anything else on engines without the API. */
const listPlatformTimezones = (): string[] => {
  let ids: string[] = [];
  try {
    ids = Intl.supportedValuesOf('timeZone');
  } catch {
    ids = [];
  }
  return ids.includes(UTC_TIMEZONE_ID) ? ids : [...ids, UTC_TIMEZONE_ID];
};

const isConstructible = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/* An IANA id starts with a letter; engines also accept offset zones (`+02:00`), which DIAL Scheduler rejects. */
const TIMEZONE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_+\-/]*$/;

/** True when the identifier looks like an IANA id and `Intl` can format in it; an unknown name, an offset such as `+02:00` or an empty string is not a zone. */
export const isKnownTimezone = (timezone: string): boolean =>
  TIMEZONE_ID_PATTERN.test(timezone) && isConstructible(timezone);

const applyRename = (timezone: string): string => {
  const renamed = LEGACY_TIMEZONE_RENAMES[timezone];
  return renamed && isConstructible(renamed) ? renamed : timezone;
};

/* V8 resolves a current name back to its legacy one (`Asia/Kolkata` to `Asia/Calcutta`), so the rename runs after resolving. */
const canonicalOf = (timezone: string): string => {
  try {
    const resolved =
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      }).resolvedOptions().timeZone || timezone;
    return applyRename(resolved);
  } catch {
    return timezone;
  }
};

/** True when both identifiers name the same zone once legacy names are resolved (`Europe/Kiev` and `Europe/Kyiv`). */
export const isSameTimezone = (a: string, b: string): boolean =>
  a === b || applyRename(a) === applyRename(b);

/** Maps every listed id to its current name and drops the duplicates that creates (`Etc/UTC` beside `UTC`). */
const collapseAliases = (ids: string[]): string[] => [
  ...new Set(ids.map(canonicalOf)),
];

/* English is added because the abbreviation or name a user types (`CET`, `Central European`) is the conventional one, which the active locale may not spell that way. */
const FALLBACK_LOCALES = ['en-GB', 'en-US'] as const;

const listLocales = (locale: string | undefined): (string | undefined)[] => [
  ...new Set([locale, ...FALLBACK_LOCALES]),
];

/** The first letters-only short name (`CET`, `EST`) any of the locales gives, or `undefined` when the zone has none. */
const toAbbreviation = (
  timezone: string,
  at: Date,
  locale: string | undefined,
): string | undefined => {
  for (const candidate of listLocales(locale)) {
    const value = readZoneName(timezone, 'short', at, candidate);
    if (
      value &&
      LETTERS_ONLY_PATTERN.test(value) &&
      value.toUpperCase() !== 'GMT'
    ) {
      return value;
    }
  }
  return undefined;
};

/** Every distinct letters-only short name the zone has across the moments, in any of the locales. */
const collectAbbreviations = (
  timezone: string,
  moments: Date[],
  locale: string | undefined,
): string[] => {
  const names = moments.flatMap((at) =>
    listLocales(locale).map((candidate) =>
      readZoneName(timezone, 'short', at, candidate),
    ),
  );
  return names.filter(
    (name): name is string =>
      !!name && LETTERS_ONLY_PATTERN.test(name) && name.toUpperCase() !== 'GMT',
  );
};

/** Descriptive names such as `Central European Summer Time`, so a search for the region finds the zone. */
const collectLongNames = (
  timezone: string,
  moments: Date[],
  locale: string | undefined,
): string[] => {
  const locales = [...new Set([locale, 'en-US'])];
  const names = moments.flatMap((at) =>
    locales.flatMap((candidate) =>
      (['long', 'longGeneric'] as const).map((style) =>
        readZoneName(timezone, style, at, candidate),
      ),
    ),
  );
  return names.filter(
    (name): name is string => !!name && !name.startsWith('GMT'),
  );
};

const buildSearchTerms = (
  id: string,
  offsetMinutes: number,
  names: string[],
): string[] => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / MINUTES_PER_HOUR);
  const minutes = absolute % MINUTES_PER_HOUR;
  const terms = [
    formatOffsetLabel(offsetMinutes),
    `${sign}${pad(hours)}:${pad(minutes)}`,
    `${sign}${hours}:${pad(minutes)}`,
    `${sign}${pad(hours)}`,
    `${sign}${hours}`,
    id,
    id.replace(/[_/]/g, ' '),
    ...names,
  ];
  return [
    ...new Set(
      terms
        .filter((term): term is string => !!term)
        .map((term) => term.toLowerCase()),
    ),
  ];
};

/**
 * Returns every selectable IANA zone as a picker row, sorted by UTC offset and
 * then by identifier. Offsets and the abbreviation are read at `now`; the
 * abbreviation falls back to English (`CET`) where the locale gives none. Search
 * terms also carry the January and July abbreviations and the long names
 * (`Central European Time`), so `CEST` or a region name is found in any month;
 * they are computed when a row's `searchTerms` is first read.
 */
export const getTimezoneOptions = ({
  now = new Date(),
  locale,
}: GetTimezoneOptionsParams = {}): ScheduledTaskTimezoneOption[] => {
  const year = now.getUTCFullYear();
  const january = new Date(Date.UTC(year, 0, 15, 12));
  const july = new Date(Date.UTC(year, 6, 15, 12));

  return collapseAliases(listPlatformTimezones())
    .map((id): ScheduledTaskTimezoneOption => {
      const offsetMinutes = parseOffsetMinutes(
        readZoneName(id, 'longOffset', now, 'en-US'),
      );
      const current = toAbbreviation(id, now, locale);
      const abbreviation =
        current?.toUpperCase() === id.toUpperCase() ? undefined : current;
      const option: ScheduledTaskTimezoneOption = {
        id,
        offsetLabel: formatOffsetLabel(offsetMinutes),
        offsetMinutes,
        ...(abbreviation ? { abbreviation } : {}),
        searchTerms: [],
      };
      /* The terms need about twenty `Intl` lookups per zone and only search reads them, so they are built on first access. */
      let terms: string[] | undefined;
      Object.defineProperty(option, 'searchTerms', {
        enumerable: true,
        get: () => {
          terms ??= buildSearchTerms(id, offsetMinutes, [
            ...collectAbbreviations(id, [now, january, july], locale),
            ...collectLongNames(id, [january, july], locale),
          ]);
          return terms;
        },
      });
      return option;
    })
    .sort((a, b) => {
      if (a.offsetMinutes !== b.offsetMinutes) {
        return a.offsetMinutes - b.offsetMinutes;
      }
      if (a.id === b.id) return 0;
      return a.id < b.id ? -1 : 1;
    });
};

/**
 * Finds the option naming the same zone as `timezone`: an exact id match, else
 * the option for its canonical form, so a browser reporting `Asia/Calcutta`
 * still lands on the listed `Asia/Kolkata` row. Returns `undefined` when none.
 */
export const findTimezoneOption = (
  options: readonly ScheduledTaskTimezoneOption[],
  timezone: string | undefined,
): ScheduledTaskTimezoneOption | undefined => {
  if (!timezone) return undefined;
  const exact = options.find((option) => option.id === timezone);
  if (exact) return exact;
  const canonical = canonicalOf(timezone);
  return options.find((option) => option.id === canonical);
};
