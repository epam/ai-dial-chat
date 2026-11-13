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
 * A stored application as DIAL Core returns it. Core reads both spellings of
 * a field but answers in snake_case (`display_version`, `display_name`), while
 * the SDK types only the camelCase keys, so a stored body carries keys the
 * type does not show.
 */
interface StoredApplicationNaming {
  displayVersion?: string;
  display_version?: string;
  displayName?: unknown;
  display_name?: unknown;
}

/** Version of a stored application, whichever spelling DIAL Core used. */
export const getStoredDisplayVersion = (
  body: StoredApplicationNaming,
): string | undefined => body.displayVersion ?? body.display_version;

/** Display name of a stored application, whichever spelling DIAL Core used. */
export const getStoredDisplayName = (body: StoredApplicationNaming): unknown =>
  body.displayName ?? body.display_name;

/**
 * Returns a copy of `body` whose only version key is `displayVersion`, so a
 * stale `display_version` carried over from another stored body can never
 * win over it. `version` undefined drops both keys.
 */
export const withDisplayVersion = <T extends object>(
  body: T,
  version: string | undefined,
): T => {
  const {
    display_version: _snake,
    displayVersion: _camel,
    ...rest
  } = body as T & StoredApplicationNaming;
  return (version == null ? rest : { ...rest, displayVersion: version }) as T;
};

/**
 * Returns a copy of `body` whose only name key is `displayName`, so the
 * stored `display_name` cannot shadow the name being written.
 */
export const withDisplayName = <T extends object>(
  body: T,
  displayName: unknown,
): T => {
  const {
    display_name: _snake,
    displayName: _camel,
    ...rest
  } = body as T & StoredApplicationNaming;
  return { ...rest, displayName } as T;
};
