import {
  CELEBRATION_ID_MAX_LENGTH,
  CELEBRATION_ID_PATTERN,
} from './constants/celebrations.constants';

/** Outcome of a normalizer: the allowlisted value, or why the input was rejected. */
export type CelebrationNormalization<T> = { value: T } | { error: string };

/** Returns `true` for a plain JSON object (not `null`, not an array). */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Returns `true` when the value is a string that matches the pattern. */
export const isMatching = (value: unknown, pattern: RegExp): value is string =>
  typeof value === 'string' && pattern.test(value);

/** Returns `true` for an event, pack or scene ID. */
export const isCelebrationId = (value: unknown): value is string =>
  isMatching(value, CELEBRATION_ID_PATTERN) &&
  value.length <= CELEBRATION_ID_MAX_LENGTH;

/** Returns `true` for an integer in `[min, max]`. */
export const isIntegerInRange = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;

/** Returns `true` when the value is one of the enum's string values. */
export const isEnumValue = <T extends string>(
  values: Record<string, T>,
  value: unknown,
): value is T => Object.values<unknown>(values).includes(value);
