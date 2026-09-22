import {
  DEPRECATED_UI_FEATURE_ALIASES,
  KNOWN_UI_FEATURES,
} from './known-ui-features.constants';

/**
 * Normalizes the `uiFeatures.enabledUiFeatures` value resolved from
 * `ENABLED_UI_FEATURES` into the list the client-config response carries.
 *
 * Takes a `warn` callback rather than a logger: this module has no `@nestjs/common`
 * dependency and constructs nothing, so `AppConfigService` passes
 * `(message) => this.logger.warn(message)` to keep every warning under its own
 * `Logger` context. Passing the unbound `this.logger.warn` instead would drop
 * that context, since `Logger.warn` reads instance state.
 *
 * Returns `string[] | null`, never `[]`: `null` means "use the compiled-in
 * frontend defaults", while an empty array would mean "enable nothing", which
 * disables the entire UI. A non-array, absent, or empty `value`, or a non-empty
 * `value` whose entries are all unrecognized, therefore both fall back to `null`
 * — the latter with an extra warning so the all-unrecognized case is visible in
 * operator logs, the former silently, since there was nothing to reject.
 *
 * Each entry is coerced with `String(entry)` before either lookup. The deprecated
 * alias map is checked before the allowlist, so a renamed value resolves to its
 * replacement (with a warning) rather than being rejected outright. Warnings are
 * emitted once per occurrence, in input order, before deduplication — a value
 * repeated in the input warns once per repetition. Accepted values are
 * deduplicated after alias resolution, preserving first occurrence, so a
 * deprecated alias and its replacement supplied together collapse to one entry.
 */
export const normalizeEnabledUiFeatures = (
  value: unknown,
  warn: (message: string) => void,
): string[] | null => {
  const rawValue = Array.isArray(value) ? value : [];
  if (rawValue.length === 0) {
    return null;
  }

  const filtered = rawValue.reduce<string[]>((acc, entry) => {
    const raw = String(entry);
    const alias = DEPRECATED_UI_FEATURE_ALIASES[raw];
    if (alias != null) {
      warn(
        `ENABLED_UI_FEATURES entry "${raw}" is deprecated; using "${alias}" instead`,
      );
      acc.push(alias);
      return acc;
    }
    if (KNOWN_UI_FEATURES.has(raw)) {
      acc.push(raw);
      return acc;
    }
    warn(`Ignoring unrecognized ENABLED_UI_FEATURES entry: "${raw}"`);
    return acc;
  }, []);

  if (filtered.length === 0) {
    warn(
      'ENABLED_UI_FEATURES contained only unrecognized entries; falling back to compiled-in defaults',
    );
    return null;
  }

  /* A deprecated alias can resolve onto a value the list already carries, so
   * dedupe before the response goes out. */
  return [...new Set(filtered)];
};
