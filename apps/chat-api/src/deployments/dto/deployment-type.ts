/** Deployment kinds DIAL Core's user usage/limits reports can enumerate. */
export enum DeploymentType {
  Model = 'model',
  Application = 'application',
}

/*
 * Normalizes a comma-separated string or an array of them (a repeated query
 * key, as the generated client sends arrays) into trimmed, non-empty,
 * de-duplicated entries in first-seen order. Anything else is returned as is,
 * so the caller's validators reject it rather than this coercing it away.
 */
export const normalizeDeploymentTypesInput = (value: unknown): unknown => {
  if (typeof value !== 'string' && !Array.isArray(value)) return value;

  const entries = (typeof value === 'string' ? [value] : value).flatMap(
    (entry: unknown) =>
      typeof entry === 'string'
        ? entry.split(',').map((part) => part.trim())
        : [entry],
  );

  return [...new Set(entries.filter((entry) => entry !== ''))];
};
