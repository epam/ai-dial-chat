import type { AdmissionLog } from './admission-log';
import { admitJsonArray } from './json-array.admission';

/**
 * Admits `ANNOUNCEMENTS` fail-open: an unset or empty value, invalid JSON or a
 * non-array resolves to `undefined`, so the registry default (an empty list)
 * applies and the pill stays hidden. Entry-level validation is shared
 * normalization (`normalizeAnnouncements`), not environment admission.
 */
export const admitAnnouncements = (
  raw: string | undefined,
  log: AdmissionLog,
): unknown[] | undefined => admitJsonArray(raw, 'ANNOUNCEMENTS', log);
