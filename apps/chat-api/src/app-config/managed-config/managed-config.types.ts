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

/** What a managed registry key exports into the Config Studio schema. */
export interface ManagedKeyContract {
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
  /**
   * The value constraints. Required for a config key, absent for a feature,
   * whose value is always a `ManagedFeatureState`.
   */
  readonly value?: ManagedValueSchema;
}

/** When a managed feature is available; at least one boundary is present. */
export interface ManagedAvailability {
  /** Inclusive start, a UTC timestamp `YYYY-MM-DDTHH:MM:SS[.fff]Z`. */
  readonly startsAt?: string;
  /** Exclusive end, a UTC timestamp `YYYY-MM-DDTHH:MM:SS[.fff]Z`. */
  readonly endsAt?: string;
}

/** Who a managed feature is for; omitted targeting means everyone. */
export interface ManagedTargeting {
  /** 1–50 distinct verified role names; a user needs at least one. */
  readonly roles: readonly string[];
}

/** The published state of one managed feature. */
export interface ManagedFeatureState {
  /** Whether the feature is on, within `availability` and `targeting`. */
  readonly enabled: boolean;
  /** Optional availability window. */
  readonly availability?: ManagedAvailability;
  /** Optional role targeting. */
  readonly targeting?: ManagedTargeting;
}

/**
 * A managed publication. Members are keyed by full registry keys; an omitted
 * key means the publication supplies no value for it.
 */
export interface ManagedConfigPayload {
  /** Plain JSON values of managed config keys, never `null`. */
  readonly config: Readonly<Record<string, unknown>>;
  /** States of managed features. */
  readonly features: Readonly<Record<string, ManagedFeatureState>>;
}

/**
 * A published snapshot as Config Studio's runtime read returns it. Identity
 * lives in this envelope, not in the payload.
 */
export interface ManagedConfigSnapshot {
  /** The Config Studio runner instance. */
  readonly instanceId: string;
  /** The Config Studio application id; `chat-ui` for Chat. */
  readonly appId: string;
  /** The instance's environment label, when it has one. */
  readonly environment?: string;
  /** The schema version the payload was validated against. */
  readonly schemaVersion: string;
  /** Canonical SHA-256 of that schema. */
  readonly schemaSha256: string;
  /** Immutable publication revision. */
  readonly revisionId: string;
  /** Canonical SHA-256 of the payload. */
  readonly sha256: string;
  /** Publication time. */
  readonly publishedAt: string;
  /** The published values. */
  readonly payload: unknown;
}
