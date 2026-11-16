import type { AdmissionLog } from './admission-log';

/**
 * Admits a JSON-array variable fail-open: an unset or empty value, invalid
 * JSON or a non-array resolves to `undefined`, so the registry default (an
 * empty list) applies. Entry-level validation is shared normalization, not
 * environment admission.
 */
export const admitJsonArray = (
  raw: string | undefined,
  envName: string,
  log: AdmissionLog,
): unknown[] | undefined => {
  if (!raw) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.error(`${envName} is not valid JSON; resolving to an empty list`);
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    log.error(`${envName} must be a JSON array; resolving to an empty list`);
    return undefined;
  }

  return parsed;
};
