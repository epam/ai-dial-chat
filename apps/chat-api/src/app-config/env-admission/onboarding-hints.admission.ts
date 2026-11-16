import type { AdmissionLog } from './admission-log';

/**
 * Admits `ONBOARDING_HINTS` fail-open: an unset or empty value, invalid JSON
 * or a non-array resolves to `undefined`, so the registry default (an empty
 * list) applies and no hint is shown. Entry-level validation is shared
 * normalization (`normalizeOnboardingHints`), not environment admission.
 */
export const admitOnboardingHints = (
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
    log.error('ONBOARDING_HINTS is not valid JSON; resolving to an empty list');
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    log.error(
      'ONBOARDING_HINTS must be a JSON array; resolving to an empty list',
    );
    return undefined;
  }

  return parsed;
};
