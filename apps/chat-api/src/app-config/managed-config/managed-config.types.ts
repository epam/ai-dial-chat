/**
 * Why a registry key can never be managed through Config Studio. Each reason
 * names the local dependency a remote value would bypass.
 */
export enum LocalOnlyReason {
  /** Needs a local model, credential, service or DIAL Core capability. */
  Capability = 'capability',
  /** A URL of this deployment's topology. */
  DeploymentTopology = 'deployment-topology',
  /** CSP, iframe, embedding, HTML or external-content admission. */
  SecurityPolicy = 'security-policy',
  /** Must equal a limit the BFF enforces. */
  BackendEnforcedLimit = 'backend-enforced-limit',
  /** Stamped by the build or release pipeline. */
  BuildMetadata = 'build-metadata',
  /** Computed from another local value. */
  Derived = 'derived',
  /** Client-owned JSON with no declared schema. */
  Opaque = 'opaque',
}

/** The JSON Schema `type` values a managed value schema may use. */
export enum ManagedSchemaType {
  String = 'string',
  Integer = 'integer',
  Number = 'number',
  Boolean = 'boolean',
  Array = 'array',
  Object = 'object',
}

/** Config Studio editor metadata, as the DIAL UI Kit `SchemaRenderer` reads it. */
export interface ManagedDialMeta {
  /** Display position among sibling properties, ascending. */
  readonly 'dial:propertyOrder': number;
}

/** Annotations allowed on every managed schema node; they never change validity. */
export interface ManagedSchemaAnnotations {
  /** Operator-facing English label. */
  readonly title?: string;
  /** Operator-facing English help text; never an environment name or value. */
  readonly description?: string;
  /** Editor metadata for Config Studio. */
  readonly 'dial:meta'?: ManagedDialMeta;
}

/** A bounded free-text string. */
export interface ManagedBoundedStringSchema extends ManagedSchemaAnnotations {
  readonly type: ManagedSchemaType.String;
  /** Lower length bound in UTF-16 code units. */
  readonly minLength?: number;
  /** Upper length bound in UTF-16 code units; every managed string has one. */
  readonly maxLength: number;
  /** ECMAScript regular expression the value must match somewhere. */
  readonly pattern?: string;
}

/** A string restricted to a fixed set of values, which bounds it. */
export interface ManagedEnumStringSchema extends ManagedSchemaAnnotations {
  readonly type: ManagedSchemaType.String;
  /** The accepted values. */
  readonly enum: readonly string[];
}

/** An integer or a number with optional inclusive bounds. */
export interface ManagedNumericSchema extends ManagedSchemaAnnotations {
  readonly type: ManagedSchemaType.Integer | ManagedSchemaType.Number;
  /** Inclusive lower bound. */
  readonly minimum?: number;
  /** Inclusive upper bound. */
  readonly maximum?: number;
}

/** A boolean. */
export interface ManagedBooleanSchema extends ManagedSchemaAnnotations {
  readonly type: ManagedSchemaType.Boolean;
}

/** A bounded list. */
export interface ManagedArraySchema extends ManagedSchemaAnnotations {
  readonly type: ManagedSchemaType.Array;
  /** The schema every item must satisfy. */
  readonly items: ManagedValueSchema;
  /** Lower item-count bound. */
  readonly minItems?: number;
  /** Upper item-count bound; every managed array has one. */
  readonly maxItems: number;
  /** Whether items must be distinct. */
  readonly uniqueItems?: boolean;
}

/** A closed object: undeclared members are always rejected. */
export interface ManagedObjectSchema extends ManagedSchemaAnnotations {
  readonly type: ManagedSchemaType.Object;
  /** The declared members. */
  readonly properties: Readonly<Record<string, ManagedValueSchema>>;
  /** Members that must be present. */
  readonly required?: readonly string[];
  /** Always `false`: an unknown member is a validation error. */
  readonly additionalProperties: false;
  /** Lower bound on the number of members present. */
  readonly minProperties?: number;
}

/**
 * The typed subset of JSON Schema 2020-12 a managed value may declare. It has
 * no `$ref`, `$id` or `format`: every constraint is one that Config Studio's
 * Ajv (`validateFormats: false`) enforces, and the generator emits references
 * only to its own `$defs`.
 */
export type ManagedValueSchema =
  | ManagedBoundedStringSchema
  | ManagedEnumStringSchema
  | ManagedNumericSchema
  | ManagedBooleanSchema
  | ManagedArraySchema
  | ManagedObjectSchema;

/** What every managed key exports besides its value constraints. */
export interface ManagedKeyAnnotations {
  /** Operator-facing English label (the schema `title`). */
  readonly title: string;
  /**
   * Operator-facing English help text (the schema `description`). It never
   * names an environment variable, an environment value, a secret or a
   * deployment URL.
   */
  readonly description: string;
  /** Display position within its section (`dial:meta["dial:propertyOrder"]`). */
  readonly order: number;
  /** Whether Config Studio hides the field (exported as `isHidden: true`). */
  readonly isHidden?: boolean;
}

/** What a managed config key exports: its annotations and value constraints. */
export interface ManagedConfigKeyContract extends ManagedKeyAnnotations {
  /** The value constraints. */
  readonly value: ManagedValueSchema;
}

/** How a registry key relates to the Config Studio contract. */
export enum KeyManagementKind {
  /** A config key exported with its own value schema. */
  ManagedConfig = 'managed-config',
  /** A feature exported with the shared feature-state schema. */
  ManagedFeature = 'managed-feature',
  /** A key that can never be managed; it is never exported. */
  LocalOnly = 'local-only',
}

/** A config key in the exported contract. */
export interface ManagedConfigKey {
  readonly kind: KeyManagementKind.ManagedConfig;
  readonly contract: ManagedConfigKeyContract;
}

/** A feature in the exported contract; its value is always a feature state. */
export interface ManagedFeatureKey {
  readonly kind: KeyManagementKind.ManagedFeature;
  readonly contract: ManagedKeyAnnotations;
}

/** A key that stays local, with the dependency a remote value would bypass. */
export interface LocalOnlyKey {
  readonly kind: KeyManagementKind.LocalOnly;
  readonly reason: LocalOnlyReason;
}

/**
 * A registry key's classification. Absent means eligible but unmanaged: the
 * key could be managed by a future schema version but is not exported today.
 */
export type KeyManagement = ManagedConfigKey | ManagedFeatureKey | LocalOnlyKey;
