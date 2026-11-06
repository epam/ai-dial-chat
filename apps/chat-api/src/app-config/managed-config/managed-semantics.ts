import { ManagedSemanticConstraintCode } from './managed-config-schema';

/** One semantic rule a schema-valid payload breaks. */
export interface ManagedSemanticIssue {
  /** RFC 6901 JSON pointer into the payload. */
  readonly pointer: string;
  readonly code: ManagedSemanticConstraintCode;
}

const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

const escapePointerToken = (token: string): string =>
  token.replace(/~/g, '~0').replace(/\//g, '~1');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/*
 * The instant a UTC timestamp names, or `undefined` when its date does not
 * exist (February 30th, February 29th of a common year). The schema pattern
 * already bounds every component's range.
 */
const parseCalendarInstant = (value: string): number | undefined => {
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const milliseconds = Number((match[7] ?? '0').padEnd(3, '0'));
  /* setUTCFullYear, not Date.UTC, which maps years 0–99 to 1900–1999. */
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milliseconds);
  const isSameDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isSameDate ? date.getTime() : undefined;
};

/**
 * Checks the rules JSON Schema cannot express on a payload that already
 * passed schema validation:
 * - `calendar_date`: every `startsAt`/`endsAt` names a date that exists;
 * - `window_order`: when both are present, `startsAt` is earlier than
 *   `endsAt`.
 *
 * Returns every issue with its JSON pointer; an empty list means the payload
 * is semantically valid. Anything that is not shaped like a payload yields no
 * issue, because schema validation reports it.
 */
export const validateManagedSemantics = (
  payload: unknown,
): ManagedSemanticIssue[] => {
  if (!isRecord(payload) || !isRecord(payload['features'])) {
    return [];
  }

  const issues: ManagedSemanticIssue[] = [];
  for (const [key, state] of Object.entries(payload['features'])) {
    if (!isRecord(state) || !isRecord(state['availability'])) continue;
    const availability = state['availability'];
    const pointer = `/features/${escapePointerToken(key)}/availability`;

    const instants = new Map<string, number>();
    for (const boundary of ['startsAt', 'endsAt']) {
      const value = availability[boundary];
      if (typeof value !== 'string') continue;
      const instant = parseCalendarInstant(value);
      if (instant === undefined) {
        issues.push({
          pointer: `${pointer}/${boundary}`,
          code: ManagedSemanticConstraintCode.CalendarDate,
        });
      } else {
        instants.set(boundary, instant);
      }
    }

    const startsAt = instants.get('startsAt');
    const endsAt = instants.get('endsAt');
    if (startsAt !== undefined && endsAt !== undefined && startsAt >= endsAt) {
      issues.push({
        pointer,
        code: ManagedSemanticConstraintCode.WindowOrder,
      });
    }
  }
  return issues;
};
