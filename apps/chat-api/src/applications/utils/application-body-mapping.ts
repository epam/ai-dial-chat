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
