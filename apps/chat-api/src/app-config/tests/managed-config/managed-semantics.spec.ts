import { describe, expect, it } from 'vitest';
import { ManagedSemanticConstraintCode } from '../../managed-config/managed-config-schema';
import { validateManagedSemantics } from '../../managed-config/managed-semantics';

const FEATURE = 'features.usageLimitsControl';
const POINTER = `/features/${FEATURE}/availability`;

const withWindow = (availability: Record<string, string>) => ({
  config: {},
  features: { [FEATURE]: { enabled: true, availability } },
});

describe('validateManagedSemantics', () => {
  it('accepts a payload without windows', () => {
    expect(validateManagedSemantics({ config: {}, features: {} })).toEqual([]);
    expect(
      validateManagedSemantics({
        config: {},
        features: { [FEATURE]: { enabled: true } },
      }),
    ).toEqual([]);
  });

  it('reports an impossible date at its pointer', () => {
    expect(
      validateManagedSemantics(
        withWindow({ startsAt: '2026-02-30T00:00:00Z' }),
      ),
    ).toEqual([
      {
        pointer: `${POINTER}/startsAt`,
        code: ManagedSemanticConstraintCode.CalendarDate,
      },
    ]);
  });

  it.each([
    ['2028-02-29T00:00:00Z', []],
    ['2000-02-29T12:00:00Z', []],
    ['0050-01-01T00:00:00Z', []],
    ['0004-02-29T00:00:00Z', []],
    [
      '2027-02-29T00:00:00Z',
      [{ pointer: `${POINTER}/endsAt`, code: 'calendar_date' }],
    ],
    [
      '2100-02-29T00:00:00Z',
      [{ pointer: `${POINTER}/endsAt`, code: 'calendar_date' }],
    ],
    [
      '2026-04-31T00:00:00Z',
      [{ pointer: `${POINTER}/endsAt`, code: 'calendar_date' }],
    ],
  ])('checks the leap-day and month-length rules for %s', (endsAt, issues) => {
    expect(validateManagedSemantics(withWindow({ endsAt }))).toEqual(issues);
  });

  it('reports an inverted window at the availability pointer', () => {
    expect(
      validateManagedSemantics(
        withWindow({
          startsAt: '2026-12-01T00:00:00Z',
          endsAt: '2026-11-01T00:00:00Z',
        }),
      ),
    ).toEqual([
      { pointer: POINTER, code: ManagedSemanticConstraintCode.WindowOrder },
    ]);
  });

  it('reports equal boundaries, because endsAt is exclusive', () => {
    expect(
      validateManagedSemantics(
        withWindow({
          startsAt: '2026-11-01T00:00:00Z',
          endsAt: '2026-11-01T00:00:00.000Z',
        }),
      ),
    ).toEqual([
      { pointer: POINTER, code: ManagedSemanticConstraintCode.WindowOrder },
    ]);
  });

  it('compares milliseconds', () => {
    expect(
      validateManagedSemantics(
        withWindow({
          startsAt: '2026-11-01T00:00:00.5Z',
          endsAt: '2026-11-01T00:00:00.501Z',
        }),
      ),
    ).toEqual([]);
  });

  it.each([
    [{ startsAt: '2026-11-01T08:00:00Z' }],
    [{ endsAt: '2026-11-01T08:00:00Z' }],
  ])('accepts an open window %j', (availability) => {
    expect(validateManagedSemantics(withWindow(availability))).toEqual([]);
  });

  it('skips window_order when a boundary is not a calendar date', () => {
    expect(
      validateManagedSemantics(
        withWindow({
          startsAt: '2026-12-31T00:00:00Z',
          endsAt: '2026-02-30T00:00:00Z',
        }),
      ),
    ).toEqual([
      {
        pointer: `${POINTER}/endsAt`,
        code: ManagedSemanticConstraintCode.CalendarDate,
      },
    ]);
  });

  it('escapes key characters in the pointer', () => {
    expect(
      validateManagedSemantics({
        config: {},
        features: {
          'a/b~c': {
            enabled: true,
            availability: { startsAt: '2026-02-30T00:00:00Z' },
          },
        },
      }),
    ).toEqual([
      {
        pointer: '/features/a~1b~0c/availability/startsAt',
        code: ManagedSemanticConstraintCode.CalendarDate,
      },
    ]);
  });

  it.each([null, 'payload', [], { config: {} }, { features: [] }])(
    'leaves a malformed payload %j to schema validation',
    (payload) => {
      expect(validateManagedSemantics(payload)).toEqual([]);
    },
  );
});
