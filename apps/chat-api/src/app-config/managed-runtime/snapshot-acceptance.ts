import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import chatSchemaArtifact100 from '../../../managed-config-schema/ai-dial-chat-1.0.0.json';
import chatSchemaArtifact110 from '../../../managed-config-schema/ai-dial-chat-1.1.0.json';
import chatSchemaArtifact120 from '../../../managed-config-schema/ai-dial-chat-1.2.0.json';
import {
  canonicalByteLength,
  canonicalSha256,
} from '../managed-config/canonical-json';
import { SCHEMA_VERSION_PATTERN } from '../managed-config/managed-config-artifact';
import {
  MANAGED_CONFIG_APP_ID,
  MAX_MANAGED_PAYLOAD_BYTES,
  PINNED_MANAGED_CONFIG_SCHEMA_SHA256,
  SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
} from '../managed-config/managed-config.constants';
import { validateManagedSemantics } from '../managed-config/managed-semantics';
import {
  ManagedRejectionReason,
  type ManagedSnapshot,
} from './managed-runtime.types';

/** A committed schema artifact, as `managed-config-schema/ai-dial-chat-<version>.json` holds it. */
interface SchemaArtifact {
  readonly appId: string;
  readonly schemaVersion: string;
  readonly schema: Record<string, unknown>;
}

/*
 * The committed artifacts of every version this build supports, bundled
 * into the build. A new supported version adds its file here, next to its
 * entry in SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS and its pin.
 */
const BUNDLED_ARTIFACTS: readonly SchemaArtifact[] = [
  chatSchemaArtifact100 as SchemaArtifact,
  chatSchemaArtifact110 as SchemaArtifact,
  chatSchemaArtifact120 as SchemaArtifact,
];

/** Validates a `ai-dial-chat` payload against one exact supported schema version. */
export type ManagedPayloadValidators = ReadonlyMap<string, ValidateFunction>;

/**
 * Compiles every supported schema version with Config Studio's Ajv options
 * (`strict: false`, formats not enforced). Throws when a supported version
 * has no bundled artifact, or an artifact's canonical hash differs from its
 * pin: such a build could accept a schema it was never released with.
 */
export const compileManagedPayloadValidators = (
  artifacts: readonly SchemaArtifact[] = BUNDLED_ARTIFACTS,
): ManagedPayloadValidators => {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: false,
    validateFormats: false,
  });
  const validators = new Map<string, ValidateFunction>();
  for (const version of SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS) {
    const artifact = artifacts.find(
      (candidate) =>
        candidate.appId === MANAGED_CONFIG_APP_ID &&
        candidate.schemaVersion === version,
    );
    if (!artifact) {
      throw new Error(`No bundled managed-config schema for ${version}`);
    }
    if (
      canonicalSha256(artifact.schema) !==
      PINNED_MANAGED_CONFIG_SCHEMA_SHA256[version]
    ) {
      throw new Error(
        `The bundled managed-config schema ${version} does not match its pinned hash`,
      );
    }
    validators.set(version, ajv.compile(artifact.schema));
  }
  return validators;
};

/** What a candidate is checked against. */
export interface AcceptanceContext {
  /** The mapped application identifier. */
  readonly appId: string;
  /** The mapped instance. */
  readonly instanceId: string;
  /** `MANAGED_CONFIG_ENVIRONMENT`, when set. */
  readonly environment?: string;
  /** The hashes of a revision this instance already accepted, if any. */
  readonly knownRevision: (
    revisionId: string,
  ) => Pick<ManagedSnapshot, 'sha256' | 'payloadSha256'> | undefined;
  readonly validators: ManagedPayloadValidators;
}

export type AcceptanceResult =
  | { readonly accepted: true; readonly snapshot: ManagedSnapshot }
  | { readonly accepted: false; readonly reason: ManagedRejectionReason };

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * The deepest object/array nesting a payload may have, the payload itself
 * being level 1. The `ai-dial-chat` schema needs 5; the bound exists because a
 * foreign payload is not schema-checked, and the canonical serialization,
 * `structuredClone` and freezing all recurse.
 */
export const MAX_MANAGED_PAYLOAD_DEPTH = 32;
/* ISO-8601 instant with an explicit `Z` or offset, as Studio writes it. */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_REVISION_ID_LENGTH = 128;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/* Iterative, so an arbitrarily deep value cannot overflow the stack here. */
const exceedsDepth = (value: unknown, maxDepth: number): boolean => {
  const pending: [unknown, number][] = [[value, 1]];
  for (let next = pending.pop(); next; next = pending.pop()) {
    const [node, depth] = next;
    if (node === null || typeof node !== 'object') continue;
    if (depth > maxDepth) return true;
    for (const member of Object.values(node)) {
      pending.push([member, depth + 1]);
    }
  }
  return false;
};

const reject = (reason: ManagedRejectionReason): AcceptanceResult => ({
  accepted: false,
  reason,
});

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const member of Object.values(value)) deepFreeze(member);
    Object.freeze(value);
  }
  return value;
};

/**
 * Checks one runtime-read body, in order: identity, envelope, payload depth and size,
 * revision immutability, and for `ai-dial-chat` the supported version, its pinned
 * hash, schema validation and the semantic constraints. A foreign
 * application's payload is never validated against a schema: the
 * application owns its contract. An accepted snapshot is a deep-frozen copy.
 */
export const acceptSnapshot = (
  body: unknown,
  context: AcceptanceContext,
): AcceptanceResult => {
  if (!isRecord(body)) return reject(ManagedRejectionReason.Malformed);
  const {
    instanceId,
    appId,
    environment,
    schemaVersion,
    schemaSha256,
    revisionId,
    sha256,
    publishedAt,
    payload,
  } = body;

  if (
    instanceId !== context.instanceId ||
    appId !== context.appId ||
    (context.environment != null && environment !== context.environment)
  ) {
    return reject(ManagedRejectionReason.IdentityMismatch);
  }

  if (
    typeof environment !== 'string' ||
    typeof schemaVersion !== 'string' ||
    !SCHEMA_VERSION_PATTERN.test(schemaVersion) ||
    typeof schemaSha256 !== 'string' ||
    !SHA256_HEX.test(schemaSha256) ||
    typeof sha256 !== 'string' ||
    !SHA256_HEX.test(sha256) ||
    !isNonEmptyString(revisionId) ||
    revisionId.length > MAX_REVISION_ID_LENGTH ||
    typeof publishedAt !== 'string' ||
    !ISO_INSTANT.test(publishedAt) ||
    Number.isNaN(Date.parse(publishedAt)) ||
    !isRecord(payload)
  ) {
    return reject(ManagedRejectionReason.Malformed);
  }

  if (exceedsDepth(payload, MAX_MANAGED_PAYLOAD_DEPTH)) {
    return reject(ManagedRejectionReason.Malformed);
  }
  if (canonicalByteLength(payload) > MAX_MANAGED_PAYLOAD_BYTES) {
    return reject(ManagedRejectionReason.PayloadTooLarge);
  }

  const payloadSha256 = canonicalSha256(payload);
  const known = context.knownRevision(revisionId);
  if (
    known &&
    (known.sha256 !== sha256 || known.payloadSha256 !== payloadSha256)
  ) {
    return reject(ManagedRejectionReason.RevisionChanged);
  }

  if (context.appId === MANAGED_CONFIG_APP_ID) {
    const validate = context.validators.get(schemaVersion);
    if (
      !validate ||
      PINNED_MANAGED_CONFIG_SCHEMA_SHA256[schemaVersion] !== schemaSha256
    ) {
      return reject(ManagedRejectionReason.UnsupportedSchema);
    }
    if (!validate(payload)) {
      return reject(ManagedRejectionReason.InvalidPayload);
    }
    if (validateManagedSemantics(payload).length > 0) {
      return reject(ManagedRejectionReason.SemanticViolation);
    }
  }

  /* A structured copy, so the caller's parsed body can never alias the
   * frozen snapshot. */
  const frozenPayload = deepFreeze(structuredClone(payload));
  return {
    accepted: true,
    snapshot: Object.freeze({
      instanceId,
      appId,
      environment,
      schemaVersion,
      schemaSha256,
      revisionId,
      sha256,
      publishedAt,
      payload: frozenPayload,
      payloadSha256,
    }),
  };
};
