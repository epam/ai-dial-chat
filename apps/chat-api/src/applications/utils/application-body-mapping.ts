import type { components } from '@epam/ai-dial-typescript-sdk';

type DialApplication = components['schemas']['Application'];

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
 * Every camelCase field of the SDK `Application` write schema. DIAL Core
 * accepts both spellings of these fields but answers a stored application in
 * snake_case (`display_version`, `icon_url`, `description_keywords`, …),
 * so each one may arrive under its snake alias.
 */
const CAMEL_CASE_APPLICATION_FIELDS = [
  'baseUrl',
  'catalogProperties',
  'catalogSchemaId',
  'createdAt',
  'defaultHeaders',
  'descriptionKeywords',
  'displayName',
  'displayVersion',
  'forwardAuthToken',
  'iconUrl',
  'inputAttachmentTypes',
  'maxInputAttachments',
  'maxRetryAttempts',
  'overrideName',
  'responsesDefaults',
  'responsesEndpoint',
  'updatedAt',
  'userRoles',
] as const satisfies readonly (keyof DialApplication)[];

const toSnakeCase = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * Converts a stored application, as DIAL Core returns it, to the camelCase
 * `Application` shape the SDK types: each snake alias of a camelCase field is
 * renamed and dropped, so a body built from it carries one key per field and
 * a stale snake key can never shadow a value written under the camelCase key.
 * When both spellings are present the camelCase value wins, as it does in
 * DIAL Core. Snake-only schema fields (`application_properties`,
 * `application_type_schema_id`, …) are left untouched.
 */
export const normalizeStoredApplication = (raw: unknown): DialApplication => {
  const body: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const camelKey of CAMEL_CASE_APPLICATION_FIELDS) {
    const snakeKey = toSnakeCase(camelKey);
    if (!(snakeKey in body)) continue;
    if (body[camelKey] === undefined) body[camelKey] = body[snakeKey];
    delete body[snakeKey];
  }
  return body as DialApplication;
};
