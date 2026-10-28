import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Catalog entity kinds whose creation `CATALOG_CREATION_ROLES` can restrict.
 * These are creation categories, not UI-feature names or catalog item ids.
 */
export enum CatalogCreationType {
  CustomApp = 'custom-app',
  SchemaApp = 'schema-app',
  Toolset = 'toolset',
  Prompt = 'prompt',
  Skill = 'skill',
}

/** Every creation type, in the fixed order client-config reports them. */
export const CATALOG_CREATION_TYPES: readonly CatalogCreationType[] = [
  CatalogCreationType.CustomApp,
  CatalogCreationType.SchemaApp,
  CatalogCreationType.Toolset,
  CatalogCreationType.Prompt,
  CatalogCreationType.Skill,
];

/**
 * The validated, not yet normalized, `CATALOG_CREATION_ROLES` value: role
 * lists by creation type and by exact application schema id.
 */
export interface CatalogCreationRolesConfig {
  types?: Partial<Record<CatalogCreationType, string[]>>;
  schemas?: Record<string, string[]>;
}

/* Never echoes the raw value, role names, or parser diagnostics. */
export const CATALOG_CREATION_ROLES_ERROR =
  'CATALOG_CREATION_ROLES must be a JSON object {"types"?: {<type>: string[]}, "schemas"?: {<schema id>: string[]}} whose types are custom-app, schema-app, toolset, prompt or skill and whose schema ids are non-blank';

/* Marks a value that is not JSON, so validation rejects it with the fixed message. */
const UNPARSEABLE = Symbol('unparseable CATALOG_CREATION_ROLES');

const TOP_LEVEL_KEYS = new Set(['types', 'schemas']);
const TYPE_KEYS = new Set<string>(CATALOG_CREATION_TYPES);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const isRoleList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((role) => typeof role === 'string');

const isRuleMap = (
  value: unknown,
  isAllowedKey: (key: string) => boolean,
): boolean =>
  isPlainObject(value) &&
  Object.entries(value).every(
    ([key, roles]) => isAllowedKey(key) && isRoleList(roles),
  );

/**
 * Parses the raw environment value. Absent or blank resolves to empty maps;
 * anything else is parsed as JSON and left for `IsCatalogCreationRoles` to
 * check, so malformed entries are rejected rather than repaired.
 */
export const parseCatalogCreationRoles = (raw: unknown): unknown => {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return { types: {}, schemas: {} };
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return UNPARSEABLE;
  }
};

/** Whether a parsed value has the exact `CATALOG_CREATION_ROLES` shape. */
export const isCatalogCreationRolesConfig = (
  value: unknown,
): value is CatalogCreationRolesConfig => {
  if (!isPlainObject(value)) {
    return false;
  }
  if (!Object.keys(value).every((key) => TOP_LEVEL_KEYS.has(key))) {
    return false;
  }
  const isTypesValid =
    value['types'] === undefined ||
    isRuleMap(value['types'], (key) => TYPE_KEYS.has(key));
  const isSchemasValid =
    value['schemas'] === undefined ||
    isRuleMap(value['schemas'], (key) => key.trim() !== '');
  return isTypesValid && isSchemasValid;
};

export const IsCatalogCreationRoles = (
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCatalogCreationRoles',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isCatalogCreationRolesConfig,
        defaultMessage() {
          return CATALOG_CREATION_ROLES_ERROR;
        },
      },
    });
  };
};
