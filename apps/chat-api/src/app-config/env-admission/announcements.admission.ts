import type { AdmissionLog } from './admission-log';

/**
 * Admits `ANNOUNCEMENTS` fail-open: an unset or empty value, invalid JSON or a
 * non-array resolves to `undefined`, so the registry default (an empty list)
 * applies and the pill stays hidden. Entry-level validation is shared
 * normalization (`normalizeAnnouncements`), not environment admission.
 */
export const admitAnnouncements = (
  raw: string | undefined,
  log: AdmissionLog,
): unknown[] | undefined => {
  if (!raw) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.error('ANNOUNCEMENTS is not valid JSON; resolving to an empty list');
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    log.error('ANNOUNCEMENTS must be a JSON array; resolving to an empty list');
    return undefined;
  }

  return parsed;
};
