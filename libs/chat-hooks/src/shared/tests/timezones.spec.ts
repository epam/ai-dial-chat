import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findTimezoneOption,
  getTimezoneOptions,
  isKnownTimezone,
  isSameTimezone,
  UTC_TIMEZONE_ID,
} from '../timezones';

const NOVEMBER = new Date('2026-11-13T12:00:00Z');
const JULY = new Date('2026-07-13T12:00:00Z');

const getIds = (options: { id: string }[]): string[] =>
  options.map((option) => option.id);

describe('getTimezoneOptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sorts by offset and then alphabetically within one offset', () => {
    const ids = getIds(getTimezoneOptions({ now: NOVEMBER, locale: 'en-GB' }));

    expect(ids.indexOf('America/St_Johns')).toBeLessThan(
      ids.indexOf('Atlantic/Cape_Verde'),
    );
    expect(ids.indexOf('Africa/Tunis')).toBeLessThan(
      ids.indexOf('Europe/Amsterdam'),
    );
    expect(ids.indexOf('Europe/Amsterdam')).toBeLessThan(
      ids.indexOf('Europe/Berlin'),
    );
  });

  it('never orders a larger offset before a smaller one', () => {
    const options = getTimezoneOptions({ now: NOVEMBER });

    for (let index = 1; index < options.length; index += 1) {
      expect(options[index].offsetMinutes).toBeGreaterThanOrEqual(
        options[index - 1].offsetMinutes,
      );
    }
  });

  it('formats offsets with a sign and zero padding', () => {
    const options = getTimezoneOptions({ now: NOVEMBER });
    const byId = new Map(options.map((option) => [option.id, option]));

    expect(byId.get('Europe/Berlin')?.offsetLabel).toBe('GMT+01:00');
    expect(byId.get('America/St_Johns')?.offsetLabel).toBe('GMT-03:30');
    expect(byId.get('Asia/Kolkata')?.offsetLabel).toBe('GMT+05:30');
    expect(byId.get('Asia/Kathmandu')?.offsetMinutes).toBe(345);
  });

  it('reads offsets at the supplied moment', () => {
    const berlinAt = (now: Date) =>
      getTimezoneOptions({ now }).find(
        (option) => option.id === 'Europe/Berlin',
      )?.offsetLabel;

    expect(berlinAt(NOVEMBER)).toBe('GMT+01:00');
    expect(berlinAt(JULY)).toBe('GMT+02:00');
  });

  it('adds UTC when the engine omits it', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue(['Europe/Berlin']);

    const options = getTimezoneOptions({ now: NOVEMBER });
    const utc = options.find((option) => option.id === UTC_TIMEZONE_ID);

    expect(utc?.offsetLabel).toBe('GMT+00:00');
    expect(utc?.abbreviation).toBeUndefined();
  });

  it('falls back to UTC alone when the engine has no zone list', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new RangeError('unsupported');
    });

    expect(getIds(getTimezoneOptions({ now: NOVEMBER }))).toEqual(['UTC']);
  });

  it('collapses an id listed beside the canonical zone it aliases', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue([
      'Etc/UTC',
      'Europe/Berlin',
    ]);

    expect(getIds(getTimezoneOptions({ now: NOVEMBER }))).toEqual([
      'UTC',
      'Europe/Berlin',
    ]);
  });

  it('lists the current name of a legacy id the engine reports', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue([
      'Asia/Calcutta',
      'Europe/Kiev',
    ]);

    const ids = getIds(getTimezoneOptions({ now: NOVEMBER }));

    expect(ids).toContain('Asia/Kolkata');
    expect(ids).toContain('Europe/Kyiv');
    expect(ids).not.toContain('Asia/Calcutta');
    expect(ids).not.toContain('Europe/Kiev');
  });

  it('shows a letter abbreviation only where some locale has one', () => {
    const options = getTimezoneOptions({ now: NOVEMBER, locale: 'en-GB' });
    const byId = new Map(options.map((option) => [option.id, option]));

    expect(byId.get('Europe/Berlin')?.abbreviation).toBe('CET');
    expect(byId.get('Asia/Kolkata')?.abbreviation).toBeUndefined();
    expect(byId.get('Asia/Tehran')?.abbreviation).toBeUndefined();
  });

  it('finds a seasonal abbreviation through search terms in any month', () => {
    const berlin = getTimezoneOptions({ now: NOVEMBER, locale: 'en-GB' }).find(
      (option) => option.id === 'Europe/Berlin',
    );

    expect(berlin?.searchTerms).toContain('cest');
    expect(berlin?.searchTerms).toContain('cet');
  });

  it('makes offset fragments, city names and unpadded offsets searchable', () => {
    const stJohns = getTimezoneOptions({ now: NOVEMBER }).find(
      (option) => option.id === 'America/St_Johns',
    );

    expect(stJohns?.searchTerms).toEqual(
      expect.arrayContaining([
        'gmt-03:30',
        '-3:30',
        '-03',
        '-3',
        'america/st_johns',
        'america st johns',
      ]),
    );
  });
});

describe('getTimezoneOptions — English fallbacks', () => {
  const byId = (locale: string) =>
    new Map(
      getTimezoneOptions({ now: NOVEMBER, locale }).map((option) => [
        option.id,
        option,
      ]),
    );

  it('shows CET for Berlin in a locale whose own short name is GMT+1', () => {
    expect(byId('en-US').get('Europe/Berlin')?.abbreviation).toBe('CET');
    expect(byId('pl').get('Europe/Berlin')?.abbreviation).toBe('CET');
  });

  it('keeps the US abbreviations too', () => {
    expect(byId('en-GB').get('America/New_York')?.abbreviation).toBe('EST');
  });

  it('finds Central European zones by CET, CEST and the region name', () => {
    const terms = byId('en-US').get('Europe/Berlin')?.searchTerms ?? [];

    expect(terms).toEqual(
      expect.arrayContaining([
        'cet',
        'cest',
        'central european time',
        'central european summer time',
      ]),
    );
    expect(terms.some((term) => term.includes('central europe'))).toBe(true);
  });

  it('finds a zone with only a standard-time name by its region', () => {
    const terms = byId('en-US').get('Africa/Tunis')?.searchTerms ?? [];

    expect(terms).toContain('central european standard time');
  });

  it('adds no generic offset-only names as search terms', () => {
    const terms = byId('en-US').get('Asia/Kolkata')?.searchTerms ?? [];

    expect(terms.filter((term) => term.startsWith('gmt'))).toEqual([
      'gmt+05:30',
    ]);
  });

  it('builds the whole list quickly enough to do on page load', () => {
    const started = performance.now();

    getTimezoneOptions({ now: NOVEMBER, locale: 'en-US' });

    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe('isKnownTimezone', () => {
  it.each(['Europe/Berlin', 'UTC', 'America/Argentina/Buenos_Aires'])(
    'accepts %s',
    (id) => {
      expect(isKnownTimezone(id)).toBe(true);
    },
  );

  it.each(['', 'Mars/Olympus', '+02:00', '+02', '../etc'])(
    'rejects %j',
    (id) => {
      expect(isKnownTimezone(id)).toBe(false);
    },
  );
});

describe('findTimezoneOption', () => {
  const options = getTimezoneOptions({ now: NOVEMBER });

  it('matches an id exactly', () => {
    expect(findTimezoneOption(options, 'Europe/Berlin')?.id).toBe(
      'Europe/Berlin',
    );
  });

  it('matches an alias through its canonical zone', () => {
    const found = findTimezoneOption(options, 'Etc/UTC');

    expect(found?.id).toBe('UTC');
  });

  it('matches a legacy name to its current row', () => {
    expect(findTimezoneOption(options, 'Asia/Calcutta')?.id).toBe(
      'Asia/Kolkata',
    );
    expect(findTimezoneOption(options, 'Europe/Kiev')?.id).toBe('Europe/Kyiv');
  });

  it('returns undefined for an empty or unknown value', () => {
    expect(findTimezoneOption(options, undefined)).toBeUndefined();
    expect(findTimezoneOption(options, 'Mars/Olympus')).toBeUndefined();
  });
});

describe('isSameTimezone', () => {
  it('treats a legacy name and its current name as one zone', () => {
    expect(isSameTimezone('Europe/Kyiv', 'Europe/Kiev')).toBe(true);
    expect(isSameTimezone('Asia/Kolkata', 'Asia/Calcutta')).toBe(true);
  });

  it('keeps different zones apart', () => {
    expect(isSameTimezone('Europe/Berlin', 'Europe/Kyiv')).toBe(false);
  });
});
