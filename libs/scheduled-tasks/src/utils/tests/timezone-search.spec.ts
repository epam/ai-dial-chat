import { describe, expect, it } from 'vitest';
import type { ScheduledTaskTimezoneOption } from '../../models/scheduled-task-timezone-props';
import {
  filterTimezoneOptions,
  normalizeTimezoneQuery,
} from '../timezone-search';

const options: ScheduledTaskTimezoneOption[] = [
  {
    id: 'America/St_Johns',
    offsetLabel: 'GMT-03:30',
    offsetMinutes: -210,
    searchTerms: ['gmt-03:30', '-3:30', 'america/st_johns', 'america st johns'],
  },
  {
    id: 'Europe/Berlin',
    offsetLabel: 'GMT+01:00',
    offsetMinutes: 60,
    abbreviation: 'CET',
    searchTerms: ['gmt+01:00', 'europe/berlin', 'europe berlin', 'cet', 'cest'],
  },
];

describe('normalizeTimezoneQuery', () => {
  it('trims and lower-cases', () => {
    expect(normalizeTimezoneQuery('  Ber ')).toBe('ber');
  });
});

describe('filterTimezoneOptions', () => {
  it('keeps every option for an empty or blank query, in order', () => {
    expect(filterTimezoneOptions(options, '').map((o) => o.id)).toEqual([
      'America/St_Johns',
      'Europe/Berlin',
    ]);
    expect(filterTimezoneOptions(options, '   ')).toHaveLength(2);
  });

  it.each([
    ['ber', ['Europe/Berlin']],
    ['BERLIN', ['Europe/Berlin']],
    ['st johns', ['America/St_Johns']],
    ['st_johns', ['America/St_Johns']],
    ['3:30', ['America/St_Johns']],
    ['+01', ['Europe/Berlin']],
    ['cest', ['Europe/Berlin']],
    ['nowhere', []],
  ])('matches %j', (query, expected) => {
    expect(filterTimezoneOptions(options, query).map((o) => o.id)).toEqual(
      expected,
    );
  });
});
