import { ENTITY_NAME_MAX_LENGTH } from './entity-field-limits';

/*
 * Display name: excludes ASCII control characters (Unicode Cc category) and
 * surrogates to prevent log-injection through names that appear in log lines.
 * Unicode-permissive otherwise, since a translated name is never used as a
 * storage-path key. The upper bound is `ENTITY_NAME_MAX_LENGTH`.
 */
export const DISPLAY_NAME_PATTERN = /^[^\p{Cc}\p{Cs}]{1,256}$/u;

export const DISPLAY_NAME_VALIDATION_MESSAGE = `Must not contain control characters and must be 1-${ENTITY_NAME_MAX_LENGTH} characters`;
