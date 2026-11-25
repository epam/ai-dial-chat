import type { components } from '@epam/ai-dial-typescript-sdk';
import type { ApplicationResourceDependencyDto } from '../dto/resource-dependency.dto';
import type { ResourceDependencyAccess } from '../types/resource-dependency-access.enum';

type DialApplication = components['schemas']['Application'];

type DialResourceDependency = components['schemas']['ResourceDependency'];

/** The `kind` DIAL Core requires on every resource dependency entry. */
const RESOURCE_LINK_KIND = 'dial.resourceLink';

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
 * The camelCase fields of the SDK `Application` write schema that DIAL Core
 * accepts under both spellings (a `@JsonAlias` on the field) but answers a
 * stored application in snake_case (`display_version`, `icon_url`,
 * `description_keywords`, …), so each one may arrive under its snake alias.
 *
 * Only list a field here once Core aliases its camelCase name. `responsesDefaults`
 * and `responsesEndpoint` are deliberately absent: Core declares them without
 * an alias, so it rejects the camelCase spelling with a 400 ("Unrecognized
 * field") and they must stay under their snake keys (`responses_defaults`,
 * `responses_endpoint`).
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

/**
 * Maps request dependency entries to the snake_case shape DIAL Core stores,
 * defaulting `required` to false.
 * @param entries - validated dependency entries from a create or update body
 */
export const toDialResourceDependencies = (
  entries: ApplicationResourceDependencyDto[],
): DialResourceDependency[] =>
  entries.map((entry) => ({
    kind: RESOURCE_LINK_KIND,
    link_id: entry.linkId,
    target: { url: entry.target.url },
    access: entry.access,
    required: entry.required ?? false,
  }));

/**
 * Maps the dependencies of a stored application to the camelCase entries the
 * API accepts. Values are passed through as stored, so an entry an
 * administrator wrote is returned faithfully.
 * @param stored - `resource_dependencies` of a stored application, if any
 */
export const fromDialResourceDependencies = (
  stored: DialResourceDependency[] | undefined,
): ApplicationResourceDependencyDto[] =>
  (stored ?? []).map((entry) => {
    const dependency: ApplicationResourceDependencyDto = {
      linkId: entry.link_id ?? '',
      target: { url: entry.target?.url ?? '' },
      access: (entry.access ?? []) as ResourceDependencyAccess[],
    };
    if (entry.required != null) dependency.required = entry.required;
    return dependency;
  });
