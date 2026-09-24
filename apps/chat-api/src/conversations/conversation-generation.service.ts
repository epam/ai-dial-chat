import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';
import {
  GenerationGaugeState,
  trackGeneration,
  type GenerationTracker,
} from '../telemetry/runtime-metrics';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from './dto/conversation-message.dto';

const STALE_ENTRY_FLOOR_MS = 30 * 60 * 1000; // 30 minutes
const STALE_GRACE_MS = 60 * 1000; // 1 minute
/* Enough digest to correlate one principal's entries across log lines. */
const OWNER_DIGEST_LENGTH = 12;
const DEFAULT_MAX_GENERATION_DURATION_MS = 1_800_000; // 30 minutes
const DEFAULT_GENERATION_FINALIZE_TIMEOUT_MS = 60_000; // 1 minute

/**
 * Persisted-marker status, preserved unchanged in meaning — mapped by
 * `backend-owned-generation-persistence` onto the four persisted outcomes
 * (success, user stop, provider error, non-user abort). Superseded, for
 * internal bookkeeping, by `GenerationLifecycleState` and
 * `GenerationCancelReason`; kept only as the public read `getStatus` exposes.
 */
export enum GenerationStatus {
  Active = 'active',
  Stopped = 'stopped',
  Done = 'done',
  Error = 'error',
}

/** Internal lifecycle of a registry entry — see `generation-registry`. */
export enum GenerationLifecycleState {
  Active = 'active',
  CancelRequested = 'cancel_requested',
  Finalizing = 'finalizing',
  Settling = 'settling',
  Released = 'released',
}

/** Why a generation's cancellation was requested — never inferred from status. */
export enum GenerationCancelReason {
  UserStop = 'user_stop',
  StaleExpiry = 'stale_expiry',
  MaxDuration = 'max_duration',
  Shutdown = 'shutdown',
}

/**
 * Opaque handle a worker uses to address its own registry entry. Minted by
 * `register` and never derived from the client-supplied `generationId`, so a
 * later replacement that reuses the same `generationId` can never be
 * inspected, mutated, notified, or tracking-decremented by an older worker's
 * callback (`generation-registry`).
 */
export interface GenerationLease {
  readonly abortController: AbortController;
  readonly operationId: number;
}

export interface GenerationCancellation {
  readonly requested: boolean;
  readonly reason?: GenerationCancelReason;
}

/**
 * Terminal event delivered to attach subscribers (`generation-live-replay`)
 * when a generation finishes, in any outcome. Mirrors the three ways
 * `ConversationStreamingService.finalize` already distinguishes an ended
 * generation for persistence purposes.
 */
export type GenerationTerminalEvent =
  { type: 'done' } | { type: 'error'; message?: string } | { type: 'stopped' };

/** Snapshot-then-live-subscription handle returned by `attach`. */
export interface GenerationAttachment {
  /** The assistant message as assembled at the moment of attaching. */
  assembledMessage: ConversationMessageDto;
  /**
   * Emits `'chunk'` with the raw parsed delta chunk for every chunk applied
   * after the snapshot was taken, and exactly one `'terminal'` event (see
   * `GenerationTerminalEvent`) when the generation ends.
   */
  emitter: EventEmitter;
}

/*
 * Under header authentication the owner key contains the caller's OIDC
 * subject, so it must never reach a log line verbatim
 * (`generation-principal-ownership`). Operators keep the ability to correlate
 * a principal's entries through the digest; the subject itself does not leave
 * the process.
 */
const digestOwnerKey = (ownerKey: string): string =>
  createHash('sha256')
    .update(ownerKey)
    .digest('hex')
    .slice(0, OWNER_DIGEST_LENGTH);

const createPlaceholderMessage = (): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: new Date().toISOString(),
});

const toGaugeState = (state: GenerationLifecycleState): GenerationGaugeState =>
  state as unknown as GenerationGaugeState;

interface GenerationEntry {
  key: string;
  generationId: string;
  operationId: number;
  abortController: AbortController;
  lifecycleState: GenerationLifecycleState;
  cancelReason?: GenerationCancelReason;
  startedAt: number;
  /**
   * The assistant message as currently assembled. Seeded with an empty
   * placeholder at `register`, overwritten once with the real start-state
   * message via `seedAssembledMessage`, then kept current by `applyChunk` as
   * the generation streams — so a late `attach` always has something valid
   * to snapshot.
   */
  assembledMessage: ConversationMessageDto;
  /** Per-generation event bus for `generation-live-replay` attach subscribers. */
  emitter: EventEmitter;
  /**
   * Server-owned bound, independent of the client connection: requests
   * cancellation if the entry is still `Active` after
   * `MAX_GENERATION_DURATION_MS`. Cleared by settlement, so a normal-speed
   * generation never triggers it. Resolves its target by `operationId`, so a
   * timer armed for one generation can never abort a later one on the same
   * key.
   */
  maxDurationTimer: NodeJS.Timeout;
  /**
   * Armed when the entry enters `Finalizing`; bounds subscriber/resource
   * release, never ownership. See `requestFinalizationBound`.
   */
  finalizeTimer?: NodeJS.Timeout;
  /** Guards `releaseResources` so it runs at most once per entry. */
  resourcesReleased: boolean;
  /** Reports this entry's lifecycle state on the generations gauge. */
  metrics: GenerationTracker;
  /**
   * Pre-rendered, subject-free identification of this entry for log lines:
   * the conversation path plus a truncated digest of the owner key. The
   * registry key itself must never be logged — under header authentication
   * its owner half is the caller's OIDC subject
   * (`generation-principal-ownership`) — and it is never parsed back into its
   * components, so the label is built once at `register` from the values the
   * caller supplied.
   */
  logLabel: string;
}

/**
 * In-memory registry of active generations, keyed by `` `${ownerKey}::${path}` ``.
 *
 * `ownerKey` is an **opaque principal key**, not a session id: the caller
 * resolves it through `resolvePrincipalKey`
 * (`apps/chat-api/src/auth/session/principal-key.ts`), which yields the cookie
 * session id for a cookie-authenticated caller and the verified
 * (`providerId`, `sub`) pair for a header-authenticated one. This service
 * never inspects the authentication mode and never derives the key itself —
 * it only uses it as a map key. See `generation-registry` and
 * `generation-principal-ownership`.
 *
 * Every entry present in the registry — in any lifecycle state other than
 * `Released` — is owned. `register` therefore never removes or replaces an
 * existing entry; the key is freed only by the owning worker's own single
 * settlement, once its one terminal save attempt has settled
 * (`generation-registry`, D2).
 */
@Injectable()
export class ConversationGenerationService implements OnModuleDestroy {
  private readonly logger = new Logger(ConversationGenerationService.name);
  private readonly registry = new Map<string, GenerationEntry>();
  private readonly entriesByOperationId = new Map<number, GenerationEntry>();
  private readonly maxGenerationDurationMs: number;
  private readonly staleThresholdMs: number;
  private readonly finalizeTimeoutMs: number;
  private nextOperationId = 1;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    this.maxGenerationDurationMs =
      configService.get('MAX_GENERATION_DURATION_MS', { infer: true }) ??
      DEFAULT_MAX_GENERATION_DURATION_MS;
    /*
     * Derived so the sweep can never pre-empt the max-duration timer
     * (`generation-registry`, D8): `MAX_GENERATION_DURATION_MS` has no
     * configured upper bound, so a deployment above 30 minutes must still see
     * its own timer fire first.
     */
    this.staleThresholdMs =
      Math.max(STALE_ENTRY_FLOOR_MS, this.maxGenerationDurationMs) +
      STALE_GRACE_MS;
    this.finalizeTimeoutMs =
      configService.get('GENERATION_FINALIZE_TIMEOUT_MS', { infer: true }) ??
      DEFAULT_GENERATION_FINALIZE_TIMEOUT_MS;
  }

  private buildKey(ownerKey: string, path: string): string {
    return `${ownerKey}::${path}`;
  }

  /**
   * Delivers the terminal event, drops all listeners, clears both timers, and
   * releases runtime tracking — exactly once per entry, regardless of how
   * many overlapping cleanup paths (Stop, expiry, timeout, completion, error,
   * repeated calls, shutdown, finalize-timeout) invoke it. Never touches the
   * registry key: that is `releaseKey`'s job, kept separate so a never-
   * settling save can release resources while still retaining ownership
   * (`generation-registry`, D7).
   */
  private releaseResources(
    entry: GenerationEntry,
    outcome: GenerationTerminalEvent,
  ): void {
    if (entry.resourcesReleased) return;
    entry.resourcesReleased = true;
    clearTimeout(entry.maxDurationTimer);
    if (entry.finalizeTimer) clearTimeout(entry.finalizeTimer);
    /*
     * Isolate subscribers so one throwing callback cannot prevent the others
     * from being notified or prevent the rest of this cleanup from running;
     * raw listeners preserve EventEmitter.once wrappers.
     */
    for (const listener of entry.emitter.rawListeners('terminal')) {
      try {
        listener.call(entry.emitter, outcome);
      } catch (error) {
        this.logger.error(
          'Failed to notify generation subscriber',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    entry.emitter.removeAllListeners();
  }

  /**
   * Frees the registry key and the entry's gauge count. Only ever reached
   * once the owning worker's single settlement runs — a `Settling` entry
   * keeps contributing to the gauge until its real write settles here.
   */
  private releaseKey(entry: GenerationEntry): void {
    if (this.registry.get(entry.key) === entry) {
      this.registry.delete(entry.key);
    }
    this.entriesByOperationId.delete(entry.operationId);
    entry.lifecycleState = GenerationLifecycleState.Released;
    entry.metrics.finish();
  }

  /**
   * The one settlement path (`generation-registry`, D4): releases resources
   * and the registry key together. Used by every path that knows, at the
   * moment it runs, that the generation has truly ended — normal completion,
   * error, an abandoned generator's cleanup, and shutdown. The finalize-bound
   * path below deliberately does *not* call this: it releases resources only,
   * retaining the key until the real save settles.
   */
  private settle(
    entry: GenerationEntry,
    outcome: GenerationTerminalEvent,
  ): void {
    this.releaseResources(entry, outcome);
    this.releaseKey(entry);
  }

  onModuleDestroy(): void {
    /*
     * Shutdown has its own contract, verified separately from stale
     * cancellation and never reused as eviction (`generation-registry`, D5):
     * there is no worker left to await, so every entry is settled here
     * directly, unconditionally, and makes no claim about an in-flight
     * persistence write.
     */
    for (const entry of [...this.registry.values()]) {
      entry.cancelReason ??= GenerationCancelReason.Shutdown;
      entry.abortController.abort();
      this.settle(entry, { type: 'stopped' });
    }
  }

  /**
   * Stale handling requests cancellation; it never removes an entry. The
   * owning worker still performs its own single settlement — this only sets
   * the reason and aborts. Entries that are not `Active` already have
   * cancellation requested or are finalizing/retained, so re-requesting would
   * be a pointless second abort (`generation-registry`, D3).
   */
  private requestCancellationForExpired(): void {
    const cutoff = Date.now() - this.staleThresholdMs;
    for (const entry of this.registry.values()) {
      if (
        entry.lifecycleState === GenerationLifecycleState.Active &&
        entry.startedAt < cutoff
      ) {
        this.logger.warn(`Expiring stale generation entry: ${entry.logLabel}`);
        entry.cancelReason = GenerationCancelReason.StaleExpiry;
        entry.lifecycleState = GenerationLifecycleState.CancelRequested;
        entry.metrics.setState(toGaugeState(entry.lifecycleState));
        entry.abortController.abort();
      }
    }
  }

  /**
   * Bounds subscriber/resource release when a dispatched terminal write never
   * settles. Ownership is deliberately not bounded: the key is retained so
   * `register` keeps rejecting the same principal+path
   * (`generation-registry`, D7).
   */
  private requestFinalizationBound(entry: GenerationEntry): void {
    entry.finalizeTimer = setTimeout(() => {
      if (entry.resourcesReleased) return;
      const outcome: GenerationTerminalEvent =
        entry.cancelReason === GenerationCancelReason.UserStop
          ? { type: 'stopped' }
          : { type: 'error' };
      entry.lifecycleState = GenerationLifecycleState.Settling;
      entry.metrics.setState(toGaugeState(entry.lifecycleState));
      this.releaseResources(entry, outcome);
    }, this.finalizeTimeoutMs);
  }

  register(
    ownerKey: string,
    path: string,
    generationId: string,
  ): GenerationLease {
    this.requestCancellationForExpired();

    const key = this.buildKey(ownerKey, path);
    if (this.registry.has(key)) {
      throw new ConflictException(
        `A generation is already active for this conversation. Stop it before starting a new one.`,
      );
    }

    const operationId = this.nextOperationId++;
    const abortController = new AbortController();
    const emitter = new EventEmitter();
    /*
     * Multiple clients of the same principal can all attach to the same generation
     * (generation-live-replay) — unbounded on purpose, each subscriber
     * removes its own listener on terminal/disconnect.
     */
    emitter.setMaxListeners(0);

    const entry: GenerationEntry = {
      key,
      generationId,
      operationId,
      abortController,
      lifecycleState: GenerationLifecycleState.Active,
      startedAt: Date.now(),
      assembledMessage: createPlaceholderMessage(),
      emitter,
      maxDurationTimer: undefined as unknown as NodeJS.Timeout,
      resourcesReleased: false,
      metrics: trackGeneration(GenerationGaugeState.Active),
      logLabel: `path=${path} owner=${digestOwnerKey(ownerKey)}`,
    };
    entry.maxDurationTimer = setTimeout(() => {
      const current = this.entriesByOperationId.get(operationId);
      if (
        current &&
        current.lifecycleState === GenerationLifecycleState.Active
      ) {
        this.logger.warn(
          `Aborting generation past MAX_GENERATION_DURATION_MS: ${current.logLabel}`,
        );
        current.cancelReason = GenerationCancelReason.MaxDuration;
        current.lifecycleState = GenerationLifecycleState.CancelRequested;
        current.metrics.setState(toGaugeState(current.lifecycleState));
        current.abortController.abort();
      }
    }, this.maxGenerationDurationMs);

    this.registry.set(key, entry);
    this.entriesByOperationId.set(operationId, entry);
    return { abortController, operationId };
  }

  private resolveByLease(lease: GenerationLease): GenerationEntry | undefined {
    return this.entriesByOperationId.get(lease.operationId);
  }

  /**
   * Overwrites the registry's assembled-message snapshot with the real
   * start-state message once `ConversationStreamingService.streamCompletion`
   * builds it — narrows the window during which `attach` would only see the
   * generic placeholder from `register`. Not itself a chunk, so it emits
   * nothing. A no-op if the lease's entry has been replaced or released.
   */
  seedAssembledMessage(
    lease: GenerationLease,
    message: ConversationMessageDto,
  ): void {
    const entry = this.resolveByLease(lease);
    if (!entry) return;
    entry.assembledMessage = message;
  }

  /**
   * Called once per chunk applied to the in-flight assistant message.
   * Updates the retained snapshot and broadcasts the raw delta to every
   * currently-attached late subscriber. A no-op if the lease's entry has
   * been replaced or released.
   */
  applyChunk(
    lease: GenerationLease,
    rawChunk: unknown,
    message: ConversationMessageDto,
  ): void {
    const entry = this.resolveByLease(lease);
    if (!entry) return;
    entry.assembledMessage = message;
    entry.emitter.emit('chunk', rawChunk);
  }

  /**
   * Lease-scoped cancellation read, replacing the identity-free
   * `getStatus`/`attach` reads a finalizing worker used to perform by
   * owner+path. Returns `undefined` once the lease's entry has been replaced
   * or released, so a stale worker never sees a replacement's state.
   */
  getCancellation(lease: GenerationLease): GenerationCancellation | undefined {
    const entry = this.resolveByLease(lease);
    if (!entry) return undefined;
    return {
      requested: entry.cancelReason != null,
      reason: entry.cancelReason,
    };
  }

  /**
   * Lease-scoped assembled-message read. Returns `undefined` once the
   * lease's entry has been replaced or released — callers fall back to their
   * own locally-held assembled message in that case.
   */
  getAssembledMessage(
    lease: GenerationLease,
  ): ConversationMessageDto | undefined {
    return this.resolveByLease(lease)?.assembledMessage;
  }

  /**
   * Synchronously returns the current assembled-message snapshot and the
   * emitter to subscribe to, or `undefined` when no entry exists for this
   * ownerKey+path — including one that already finalized. Callers MUST
   * attach their listener in the same synchronous step as reading
   * `assembledMessage` (no `await` in between), so no chunk emitted
   * concurrently can land in the gap between the two.
   */
  attach(ownerKey: string, path: string): GenerationAttachment | undefined {
    const entry = this.registry.get(this.buildKey(ownerKey, path));
    if (!entry) return undefined;
    return { assembledMessage: entry.assembledMessage, emitter: entry.emitter };
  }

  /** Public, client-addressed Stop. Unchanged signature and behaviour. */
  abort(ownerKey: string, path: string, generationId: string): boolean {
    const key = this.buildKey(ownerKey, path);
    const entry = this.registry.get(key);
    if (
      !entry ||
      entry.generationId !== generationId ||
      entry.lifecycleState !== GenerationLifecycleState.Active
    ) {
      return false;
    }
    entry.cancelReason = GenerationCancelReason.UserStop;
    entry.lifecycleState = GenerationLifecycleState.CancelRequested;
    entry.metrics.setState(toGaugeState(entry.lifecycleState));
    entry.abortController.abort();
    return true;
  }

  /**
   * Diagnostic read of a principal+path's current status, preserved for
   * callers outside the finalizing worker (tests, cross-request assertions).
   * Reports `Stopped` only for a user-requested cancellation, matching the
   * persisted-marker table; every other owned state reports `Active` because
   * none of them are yet a persisted terminal outcome.
   */
  getStatus(ownerKey: string, path: string): GenerationStatus | undefined {
    const entry = this.registry.get(this.buildKey(ownerKey, path));
    if (!entry) return undefined;
    return entry.cancelReason === GenerationCancelReason.UserStop
      ? GenerationStatus.Stopped
      : GenerationStatus.Active;
  }

  /**
   * Records that the terminal write has been dispatched, before the caller
   * awaits it (`generation-registry`, D5) — a cancellation arriving after
   * this point is recorded but never adds, replaces, or cancels the write.
   * Arms the finalization bound so a never-settling save still releases
   * subscribers and resources.
   */
  beginFinalizing(lease: GenerationLease): void {
    const entry = this.resolveByLease(lease);
    if (!entry) return;
    entry.lifecycleState = GenerationLifecycleState.Finalizing;
    entry.metrics.setState(toGaugeState(entry.lifecycleState));
    this.requestFinalizationBound(entry);
  }

  /** Thin lease-checked wrapper around `settle` for the success outcome. */
  complete(lease: GenerationLease): void {
    const entry = this.resolveByLease(lease);
    if (!entry) return;
    this.settle(entry, { type: 'done' });
  }

  /**
   * Thin lease-checked wrapper around `settle` for the error/stopped outcome.
   * The terminal event and persisted marker are derived from the entry's
   * cancellation reason, never from a status field several sources can set —
   * only `UserStop` yields `stopped`.
   */
  error(lease: GenerationLease, message?: string): void {
    const entry = this.resolveByLease(lease);
    if (!entry) return;
    const outcome: GenerationTerminalEvent =
      entry.cancelReason === GenerationCancelReason.UserStop
        ? { type: 'stopped' }
        : { type: 'error', message };
    this.settle(entry, outcome);
  }
}
