import type { AdmissionLog } from './admission-log';

/**
 * Admits `CUSTOM_CLIENT_VARIABLES`: a JSON object of client-owned values. An
 * unset or blank value resolves to `undefined` silently; anything that is not
 * a JSON object resolves to `undefined` with a warning that never includes the
 * payload or the parser message.
 */
export const admitCustomVariables = (
  raw: string | undefined,
  log: AdmissionLog,
): Record<string, unknown> | undefined => {
  if (!raw?.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* Do not include the payload or parser message in logs. */
  }
  log.warn(
    'CUSTOM_CLIENT_VARIABLES must be a JSON object; using an empty object',
  );
  return undefined;
};
