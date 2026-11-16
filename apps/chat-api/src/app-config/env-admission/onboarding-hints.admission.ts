import type { AdmissionLog } from './admission-log';
import { admitJsonArray } from './json-array.admission';

/**
 * Admits `ONBOARDING_HINTS` fail-open: an unset or empty value, invalid JSON
 * or a non-array resolves to `undefined`, so the registry default (an empty
 * list) applies and no hint is shown. Entry-level validation is shared
 * normalization (`normalizeOnboardingHints`), not environment admission.
 */
export const admitOnboardingHints = (
  raw: string | undefined,
  log: AdmissionLog,
): unknown[] | undefined => admitJsonArray(raw, 'ONBOARDING_HINTS', log);
