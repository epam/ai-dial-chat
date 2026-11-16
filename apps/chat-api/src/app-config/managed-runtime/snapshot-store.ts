import {
  ManagedConfigState,
  ManagedRefreshOutcome,
  type ManagedSnapshot,
} from './managed-runtime.types';

/** How many accepted revisions an instance remembers for the immutability check. */
export const ACCEPTED_REVISION_MEMORY = 32;

/** One instance's state as a capture sees it. */
export interface ManagedCapture {
  readonly state: ManagedConfigState;
  /** Present only when the state is usable. */
  readonly snapshot?: ManagedSnapshot;
  /** When the active snapshot exceeds the maximum staleness (epoch ms). */
  readonly staleAt?: number;
}

type RevisionHashes = Pick<ManagedSnapshot, 'sha256' | 'payloadSha256'>;

/**
 * The managed state of one Config Studio instance. Freshness is measured
 * from the last successful verification, never from `publishedAt`, and the
 * state is derived from the clock at capture time, so a snapshot turns stale
 * at the exact boundary even while no refresh completes.
 */
export class ManagedSnapshotStore {
  private active: ManagedSnapshot | undefined;
  private lastVerifiedAt: number | undefined;
  private lastAttemptSucceeded = false;
  private notPublished = false;
  /* Insertion-ordered, so the oldest accepted revision is evicted first. */
  private readonly accepted = new Map<string, RevisionHashes>();

  constructor(
    readonly appId: string,
    readonly instanceId: string,
    private readonly maxStalenessMs: number,
  ) {}

  /** The hashes of an accepted revision, for the immutability check. */
  knownRevision(revisionId: string): RevisionHashes | undefined {
    return this.accepted.get(revisionId);
  }

  /** The active snapshot's revision, if any. */
  get activeRevisionId(): string | undefined {
    return this.active?.revisionId;
  }

  /** When the active snapshot was last verified (epoch ms). */
  get lastVerification(): number | undefined {
    return this.lastVerifiedAt;
  }

  /**
   * Records a snapshot that passed acceptance at `now`. The active revision
   * returned again only refreshes its verification; any other revision is
   * swapped in as one immutable value.
   */
  recordAccepted(
    snapshot: ManagedSnapshot,
    now: number,
  ): ManagedRefreshOutcome.Accepted | ManagedRefreshOutcome.Verified {
    const isSameRevision = this.active?.revisionId === snapshot.revisionId;
    if (!isSameRevision) {
      this.active = snapshot;
      this.remember(snapshot);
    }
    this.lastVerifiedAt = now;
    this.lastAttemptSucceeded = true;
    this.notPublished = false;
    return isSameRevision
      ? ManagedRefreshOutcome.Verified
      : ManagedRefreshOutcome.Accepted;
  }

  /** Records that the instance has nothing published; the snapshot is discarded. */
  recordNotPublished(): void {
    this.active = undefined;
    this.lastVerifiedAt = undefined;
    this.lastAttemptSucceeded = true;
    this.notPublished = true;
  }

  /** Records a failed or rejected attempt; the active snapshot is kept. */
  recordFailure(): void {
    this.lastAttemptSucceeded = false;
    this.notPublished = false;
  }

  capture(now: number): ManagedCapture {
    if (this.notPublished) {
      return { state: ManagedConfigState.NotPublished };
    }
    if (!this.active || this.lastVerifiedAt == null) {
      return { state: ManagedConfigState.Unavailable };
    }
    const staleAt = this.lastVerifiedAt + this.maxStalenessMs;
    if (now > staleAt) {
      return { state: ManagedConfigState.Stale, staleAt };
    }
    return {
      state: this.lastAttemptSucceeded
        ? ManagedConfigState.Fresh
        : ManagedConfigState.Degraded,
      snapshot: this.active,
      staleAt,
    };
  }

  private remember(snapshot: ManagedSnapshot): void {
    this.accepted.delete(snapshot.revisionId);
    this.accepted.set(snapshot.revisionId, {
      sha256: snapshot.sha256,
      payloadSha256: snapshot.payloadSha256,
    });
    while (this.accepted.size > ACCEPTED_REVISION_MEMORY) {
      const oldest = this.accepted.keys().next().value;
      if (oldest === undefined) break;
      this.accepted.delete(oldest);
    }
  }
}
