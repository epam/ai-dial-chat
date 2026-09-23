/**
 * `endpoint`, `features`, `inputAttachmentTypes`, and `maxInputAttachments` are
 * top-level DIAL Core `Application` fields, not schema-specific configuration.
 * Both `createApplication` and `updateApplication` lift them out of a caller-supplied
 * `applicationProperties` object before it is sent (as `application_properties`) to
 * DIAL Core, so a caller may pass them either at the top level of the request body or
 * nested inside `applicationProperties` without changing where they end up on the
 * DIAL Core resource.
 */
export interface HoistedApplicationFields {
  endpoint?: string;
  features?: Record<string, unknown>;
  inputAttachmentTypes?: string[];
  maxInputAttachments?: number;
  remainingProperties: Record<string, unknown>;
}

export const hoistApplicationFields = (
  applicationProperties: Record<string, unknown> | undefined,
): HoistedApplicationFields => {
  const {
    endpoint,
    features,
    inputAttachmentTypes,
    maxInputAttachments,
    ...remainingProperties
  } = applicationProperties ?? {};

  return {
    endpoint: typeof endpoint === 'string' ? endpoint : undefined,
    features:
      features != null ? (features as Record<string, unknown>) : undefined,
    inputAttachmentTypes: Array.isArray(inputAttachmentTypes)
      ? (inputAttachmentTypes as string[])
      : undefined,
    maxInputAttachments:
      typeof maxInputAttachments === 'number' ? maxInputAttachments : undefined,
    remainingProperties,
  };
};

/**
 * Applies a `themeUrl` write to a stored DIAL Core `catalog_properties` map.
 *
 * Unlike `application_properties`, which a caller replaces wholesale, this map
 * is **merged**: chat owns only the `themeUrl` key. `provider`, `vendor`,
 * `license` and anything else the operator or DIAL Core's own catalog tooling
 * put there must survive an application save from the apps editor.
 *
 * @param stored - `catalog_properties` as DIAL Core currently holds it.
 * @param themeUrl - The requested value: `undefined`/`null` leaves the map untouched, an empty or whitespace-only string deletes the key, anything else sets it.
 * @returns The map to persist, or `undefined` when there is nothing to write.
 */
export const applyThemeUrlToCatalogProperties = (
  stored: Record<string, unknown> | undefined,
  themeUrl: string | null | undefined,
): Record<string, unknown> | undefined => {
  if (themeUrl == null) return stored;

  const trimmed = themeUrl.trim();
  const next = { ...(stored ?? {}) };

  if (trimmed === '') {
    delete next.themeUrl;
  } else {
    next.themeUrl = trimmed;
  }

  /*
   * An emptied map is written as `{}` rather than dropped, so DIAL Core's
   * stored shape stays stable across a clear.
   */
  return next;
};
