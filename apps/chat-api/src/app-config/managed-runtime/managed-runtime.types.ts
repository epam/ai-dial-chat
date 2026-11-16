/** How far a deployment lets Config Studio snapshots affect it (`MANAGED_CONFIG_MODE`). */
export enum ManagedConfigMode {
  /** No snapshot is read; behavior is environment-only. */
  Off = 'off',
  /** Snapshots are read, verified and compared; responses do not change. */
  Shadow = 'shadow',
  /** Snapshots apply to the keys listed in `MANAGED_CONFIG_ACTIVE_KEYS`. */
  Active = 'active',
}

/** The state of one instance's managed snapshot at the moment it is captured. */
export enum ManagedConfigState {
  /** Verified by the last attempt, within the maximum staleness. */
  Fresh = 'fresh',
  /** Within the maximum staleness, but the last attempt failed or was rejected. */
  Degraded = 'degraded',
  /** Older than the maximum staleness: unusable. */
  Stale = 'stale',
  /** No snapshot has been accepted yet: unusable. */
  Unavailable = 'unavailable',
  /** The instance has nothing published: unusable. */
  NotPublished = 'not_published',
}

/** Why a runtime-read candidate was rejected as a whole. */
export enum ManagedRejectionReason {
  IdentityMismatch = 'identity_mismatch',
  Malformed = 'malformed',
  PayloadTooLarge = 'payload_too_large',
  RevisionChanged = 'revision_changed',
  UnsupportedSchema = 'unsupported_schema',
  InvalidPayload = 'invalid_payload',
  SemanticViolation = 'semantic_violation',
  IntegrityMismatch = 'integrity_mismatch',
}

/** The bounded result of one refresh attempt, as metrics and logs report it. */
export enum ManagedRefreshOutcome {
  Accepted = 'accepted',
  Verified = 'verified',
  NotPublished = 'not_published',
  Denied = 'denied',
  Unavailable = 'unavailable',
  Rejected = 'rejected',
  LateDiscarded = 'late_discarded',
}

/** One accepted snapshot. Every member, the payload included, is frozen. */
export interface ManagedSnapshot {
  readonly instanceId: string;
  readonly appId: string;
  readonly environment: string;
  readonly schemaVersion: string;
  readonly schemaSha256: string;
  readonly revisionId: string;
  readonly sha256: string;
  readonly publishedAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  /** SHA-256 of the payload's canonical JSON, for the immutability check. */
  readonly payloadSha256: string;
}

/**
 * The managed state one evaluation reads: captured once by `AppConfigService`
 * so that every key of a response, and every gate of one `isEnabled` call,
 * sees the same snapshot and the same instant.
 */
export interface ManagedResolutionView {
  /** The application identifier the evaluation serves. */
  readonly appId: string;
  /** The mapped Config Studio instance; absent when the identifier is unmapped. */
  readonly instanceId?: string;
  readonly state: ManagedConfigState;
  /** Present only when `state` is usable (`fresh` or `degraded`). */
  readonly snapshot?: ManagedSnapshot;
  /** When the snapshot exceeds the maximum staleness (epoch ms); absent without a snapshot. */
  readonly staleAt?: number;
  /** The evaluation instant (epoch ms). */
  readonly now: number;
}

/** Whether a captured state lets managed values and policies apply. */
export const isUsableManagedState = (state: ManagedConfigState): boolean =>
  state === ManagedConfigState.Fresh || state === ManagedConfigState.Degraded;
