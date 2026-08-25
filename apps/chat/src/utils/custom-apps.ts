export const isValidAbsoluteUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//.test(trimmed)) return false;
  try {
    return Boolean(new URL(trimmed));
  } catch {
    return false;
  }
};

export const parseFeaturesData = (
  value: string,
): Record<string, unknown> | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const ALLOWED_FEATURES_DATA_KEYS = ['rate_endpoint', 'configuration_endpoint'];

export const isValidFeaturesData = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return false;
    const keys = Object.keys(parsed as Record<string, unknown>);
    return (
      keys.length > 0 &&
      keys.every((key) => ALLOWED_FEATURES_DATA_KEYS.includes(key))
    );
  } catch {
    return false;
  }
};
