import { canonicalByteLength } from './canonical-json';
import {
  MANAGED_CONFIG_APP_ID,
  MAX_MANAGED_PAYLOAD_BYTES,
  SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
} from './managed-config.constants';
import type { ManagedConfigSnapshot } from './managed-config.types';

/** Why a snapshot is rejected before its payload is considered. */
export enum ManagedSnapshotRejection {
  AppMismatch = 'app_mismatch',
  InstanceMismatch = 'instance_mismatch',
  EnvironmentMismatch = 'environment_mismatch',
  UnsupportedSchema = 'unsupported_schema',
  SchemaHashMismatch = 'schema_hash_mismatch',
  InvalidIdentity = 'invalid_identity',
  PayloadTooLarge = 'payload_too_large',
  RevisionChanged = 'revision_changed',
}

/** What the consuming deployment expects of a snapshot. */
export interface ManagedSnapshotExpectation {
  /** The Config Studio instance this deployment reads. */
  readonly instanceId: string;
  /** The instance environment label, when the deployment configures one. */
  readonly environment?: string;
  /**
   * Canonical `schemaSha256` of Chat's own committed artifact for each schema
   * version, as `index.json` records it.
   */
  readonly schemaHashes: ReadonlyMap<string, string>;
}

export type ManagedSnapshotCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ManagedSnapshotRejection };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const reject = (code: ManagedSnapshotRejection): ManagedSnapshotCheck => ({
  ok: false,
  code,
});

/* A payload with no JSON form cannot be shown to fit the bound. */
const exceedsPayloadLimit = (payload: unknown): boolean => {
  try {
    return canonicalByteLength(payload) > MAX_MANAGED_PAYLOAD_BYTES;
  } catch {
    return true;
  }
};

/**
 * Decides whether a future runtime consumer may use a published snapshot.
 * It performs no I/O and logs nothing; payload schema and semantic
 * validation are separate checks. The snapshot is accepted only when:
 * - `appId` is `chat-ui` and `instanceId` (and `environment`, when one is
 *   expected) match the deployment;
 * - `revisionId` and `sha256` are non-empty;
 * - `schemaVersion` is one this build supports, and `schemaSha256` equals
 *   the hash of Chat's own artifact for that version;
 * - the canonical payload is at most 57,344 bytes;
 * - a `revisionId` already in `seenRevisions` still carries the same
 *   `sha256`, because revisions are immutable.
 */
export const checkManagedSnapshot = (
  snapshot: ManagedConfigSnapshot,
  expected: ManagedSnapshotExpectation,
  seenRevisions: ReadonlyMap<string, string>,
): ManagedSnapshotCheck => {
  if (snapshot.appId !== MANAGED_CONFIG_APP_ID) {
    return reject(ManagedSnapshotRejection.AppMismatch);
  }
  if (snapshot.instanceId !== expected.instanceId) {
    return reject(ManagedSnapshotRejection.InstanceMismatch);
  }
  if (
    expected.environment !== undefined &&
    snapshot.environment !== expected.environment
  ) {
    return reject(ManagedSnapshotRejection.EnvironmentMismatch);
  }
  if (
    !isNonEmptyString(snapshot.revisionId) ||
    !isNonEmptyString(snapshot.sha256)
  ) {
    return reject(ManagedSnapshotRejection.InvalidIdentity);
  }
  const knownHash = expected.schemaHashes.get(snapshot.schemaVersion);
  if (
    !SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS.includes(
      snapshot.schemaVersion,
    ) ||
    knownHash === undefined
  ) {
    return reject(ManagedSnapshotRejection.UnsupportedSchema);
  }
  if (snapshot.schemaSha256 !== knownHash) {
    return reject(ManagedSnapshotRejection.SchemaHashMismatch);
  }
  if (exceedsPayloadLimit(snapshot.payload)) {
    return reject(ManagedSnapshotRejection.PayloadTooLarge);
  }
  const seenSha256 = seenRevisions.get(snapshot.revisionId);
  if (seenSha256 !== undefined && seenSha256 !== snapshot.sha256) {
    return reject(ManagedSnapshotRejection.RevisionChanged);
  }
  return { ok: true };
};
