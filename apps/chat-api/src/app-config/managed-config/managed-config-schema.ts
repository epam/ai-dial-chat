import type { ConfigDefinition } from '../app-config.types';
import { MANAGED_CONFIG_APP_ID } from './managed-config.constants';
import {
  KeyManagementKind,
  ManagedSchemaType,
  type ManagedConfigKeyContract,
  type ManagedKeyAnnotations,
  type ManagedValueSchema,
} from './managed-config.types';

/** A JSON value as the generator emits it. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** A JSON Schema document or node as the generator emits it. */
export type JsonSchemaObject = { readonly [key: string]: JsonValue };

/** The stable codes of the rules JSON Schema cannot express. */
export enum ManagedSemanticConstraintCode {
  /** A UTC timestamp names an instant that exists in the calendar. */
  CalendarDate = 'calendar_date',
  /** `startsAt` is earlier than `endsAt` when both are present. */
  WindowOrder = 'window_order',
}

const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

const ROOT_TITLE = 'DIAL Chat managed configuration';
const ROOT_DESCRIPTION =
  'Values published through Config Studio for one chat-ui instance. A Chat deployment applies them only when its managed reading is enabled; an explicit deployment environment override still wins, and omitted keys use the application default.';

/*
 * `YYYY-MM-DDTHH:MM:SS[.fff]Z`: UTC only, because Studio does not enforce
 * `format`. Calendar validity (February 30th) is the `calendar_date`
 * semantic constraint.
 */
export const UTC_TIMESTAMP_PATTERN =
  '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,3})?Z$';

const meta = (order: number): JsonSchemaObject => ({
  'dial:meta': { 'dial:propertyOrder': order },
});

const FEATURE_STATE_DEFINITION: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['enabled'],
  properties: {
    enabled: { type: 'boolean', title: 'Enabled', ...meta(1) },
    availability: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      title: 'Availability window',
      description:
        'startsAt is inclusive, endsAt exclusive; omit a boundary for no limit. startsAt must precede endsAt.',
      properties: {
        startsAt: {
          $ref: '#/$defs/utcTimestamp',
          title: 'Starts at',
          ...meta(1),
        },
        endsAt: { $ref: '#/$defs/utcTimestamp', title: 'Ends at', ...meta(2) },
      },
      ...meta(2),
    },
    targeting: {
      type: 'object',
      additionalProperties: false,
      required: ['roles'],
      title: 'Targeting',
      description:
        'Users need at least one listed verified role. Omit targeting for no restriction.',
      properties: {
        roles: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          uniqueItems: true,
          items: { $ref: '#/$defs/role' },
          title: 'Roles',
        },
      },
      ...meta(3),
    },
  },
};

const DEFINITIONS: JsonSchemaObject = {
  utcTimestamp: {
    type: 'string',
    maxLength: 30,
    pattern: UTC_TIMESTAMP_PATTERN,
    title: 'UTC timestamp',
    description:
      'RFC 3339 instant in UTC (Z suffix), for example 2026-11-01T08:00:00Z.',
  },
  role: {
    type: 'string',
    minLength: 1,
    maxLength: 128,
    pattern: '^[^\\s,]+$',
  },
  featureState: FEATURE_STATE_DEFINITION,
};

const SEMANTIC_CONSTRAINTS: JsonValue = [
  {
    code: ManagedSemanticConstraintCode.CalendarDate,
    pointer: '/$defs/utcTimestamp',
    description:
      'The date and time must exist in the proleptic Gregorian calendar.',
  },
  {
    code: ManagedSemanticConstraintCode.WindowOrder,
    pointer: '/$defs/featureState/properties/availability',
    description: 'When both are present, startsAt must be earlier than endsAt.',
  },
];

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      return Array.isArray(value)
        ? value.every(isJsonValue)
        : Object.values(value).every(isJsonValue);
    default:
      return false;
  }
};

/* Copies the defined members of a schema node, which are all plain JSON. */
const copyMembers = (node: object): Record<string, JsonValue> => {
  const copy: Record<string, JsonValue> = {};
  for (const [name, value] of Object.entries(node)) {
    if (value === undefined) continue;
    if (!isJsonValue(value)) {
      throw new TypeError(`Schema member ${name} is not plain JSON`);
    }
    copy[name] = value;
  }
  return copy;
};

/*
 * Copies a typed value schema into plain JSON. The typed subset already
 * excludes `$ref`, `$id` and `format`; nested nodes keep their own
 * annotations.
 */
const toJsonSchema = (schema: ManagedValueSchema): JsonSchemaObject => {
  switch (schema.type) {
    case ManagedSchemaType.Array:
      return { ...copyMembers(schema), items: toJsonSchema(schema.items) };
    case ManagedSchemaType.Object:
      return {
        ...copyMembers(schema),
        properties: Object.fromEntries(
          Object.entries(schema.properties).map(([name, child]) => [
            name,
            toJsonSchema(child),
          ]),
        ),
      };
    default:
      return copyMembers(schema);
  }
};

/*
 * Only the registry default, never a runtime value: the generator reads no
 * ConfigService, process.env or .env file. A `null` default is omitted,
 * because managed strings are never nullable.
 */
const registryDefault = (definition: ConfigDefinition): JsonSchemaObject => {
  const { defaultValue } = definition;
  if (defaultValue == null) return {};
  if (!isJsonValue(defaultValue)) {
    throw new TypeError(`${definition.key}: default is not plain JSON`);
  }
  return { default: defaultValue };
};

const keyAnnotations = (
  annotations: ManagedKeyAnnotations,
): JsonSchemaObject => ({
  title: annotations.title,
  description: annotations.description,
  ...(annotations.isHidden ? { isHidden: true } : {}),
  ...meta(annotations.order),
});

const configProperty = (
  definition: ConfigDefinition,
  contract: ManagedConfigKeyContract,
): JsonSchemaObject => ({
  ...toJsonSchema(contract.value),
  ...registryDefault(definition),
  ...keyAnnotations(contract),
});

/* Per-key title/description are siblings of the reference; SchemaRenderer
 * merges them over the shared definition. */
const featureProperty = (
  annotations: ManagedKeyAnnotations,
): JsonSchemaObject => ({
  $ref: '#/$defs/featureState',
  ...keyAnnotations(annotations),
});

interface ManagedEntry<Contract extends ManagedKeyAnnotations> {
  readonly definition: ConfigDefinition;
  readonly contract: Contract;
}

/* A managed kind must match the definition's own type, so a config contract
 * never lands in the features section or the other way round. */
const assertType = (
  definition: ConfigDefinition,
  type: ConfigDefinition['type'],
): void => {
  if (definition.type !== type) {
    throw new TypeError(
      `${definition.key} is a ${definition.type} managed as a ${type}`,
    );
  }
};

const byDisplayOrder = (
  left: ManagedEntry<ManagedKeyAnnotations>,
  right: ManagedEntry<ManagedKeyAnnotations>,
): number =>
  left.contract.order - right.contract.order ||
  left.definition.key.localeCompare(right.definition.key, 'en');

const configEntries = (
  definitions: readonly ConfigDefinition[],
): ManagedEntry<ManagedConfigKeyContract>[] =>
  definitions
    .flatMap((definition) => {
      const { management } = definition;
      if (management?.kind !== KeyManagementKind.ManagedConfig) return [];
      assertType(definition, 'config');
      return [{ definition, contract: management.contract }];
    })
    .sort(byDisplayOrder);

const featureEntries = (
  definitions: readonly ConfigDefinition[],
): ManagedEntry<ManagedKeyAnnotations>[] =>
  definitions
    .flatMap((definition) => {
      const { management } = definition;
      if (management?.kind !== KeyManagementKind.ManagedFeature) return [];
      assertType(definition, 'feature');
      return [{ definition, contract: management.contract }];
    })
    .sort(byDisplayOrder);

/** The root `$id` of a schema version. */
export const managedConfigSchemaId = (schemaVersion: string): string =>
  `urn:dial:${MANAGED_CONFIG_APP_ID}:managed-config:${schemaVersion}`;

/**
 * Builds the managed-configuration JSON Schema 2020-12 document from the
 * registry's managed entries. It is a pure function of `definitions` and
 * `schemaVersion`: no environment, file or application state is read, so
 * generating twice yields deep-equal output.
 */
export const buildManagedConfigSchema = (
  definitions: readonly ConfigDefinition[],
  schemaVersion: string,
): JsonSchemaObject => {
  const config = configEntries(definitions);
  const features = featureEntries(definitions);

  return {
    $schema: JSON_SCHEMA_DIALECT,
    $id: managedConfigSchemaId(schemaVersion),
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
    type: 'object',
    additionalProperties: false,
    required: ['config', 'features'],
    properties: {
      config: {
        type: 'object',
        additionalProperties: false,
        title: 'Configuration',
        properties: Object.fromEntries(
          config.map(({ definition, contract }) => [
            definition.key,
            configProperty(definition, contract),
          ]),
        ),
        ...meta(1),
      },
      features: {
        type: 'object',
        additionalProperties: false,
        title: 'Features',
        properties: Object.fromEntries(
          features.map(({ definition, contract }) => [
            definition.key,
            featureProperty(contract),
          ]),
        ),
        ...meta(2),
      },
    },
    'dial:semanticConstraints': SEMANTIC_CONSTRAINTS,
    $defs: DEFINITIONS,
  };
};
