import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  readManagedRuntimeSettings,
  type ManagedRuntimeSettings,
} from './managed-runtime.settings';
import {
  createManagedRuntimeTelemetry,
  type ManagedRuntimeTelemetry,
} from './managed-runtime.telemetry';
import {
  ManagedConfigMode,
  ManagedConfigState,
  ManagedRefreshOutcome,
  ManagedRejectionReason,
  type ManagedResolutionView,
  type ManagedSnapshot,
} from './managed-runtime.types';
import {
  InstanceRefreshScheduler,
  MANAGED_RUNTIME_CLOCK,
  type ManagedRuntimeClock,
} from './refresh-scheduler';
import {
  acceptSnapshot,
  compileManagedPayloadValidators,
  type ManagedPayloadValidators,
} from './snapshot-acceptance';
import {
  ManagedSnapshotReader,
  RUNTIME_READ_TIMEOUT_MS,
  RuntimeReadKind,
  type RuntimeReadResult,
} from './snapshot-reader';
import { ManagedSnapshotStore } from './snapshot-store';

/** Called after a snapshot is accepted or verified again. */
export type ManagedSnapshotListener = (snapshot: ManagedSnapshot) => void;

/* How one applied result is reported: its metric outcome and log reason. */
interface AppliedResult {
  readonly succeeded: boolean;
  readonly outcome: string;
  readonly reason?: ManagedRejectionReason | RuntimeReadKind;
}

/**
 * Keeps the published Config Studio snapshot of every served application
 * identifier that `MANAGED_CONFIG_INSTANCES` maps to an instance. It reads
 * through DIAL Core only, on its own schedule, so no browser request and no
 * configuration key ever reaches Core. In mode `off` it creates no timer and
 * sends no request, and every capture is `unavailable` without an instance.
 */
@Injectable()
export class ManagedRuntimeService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ManagedRuntimeService.name);
  readonly settings: ManagedRuntimeSettings;
  private readonly stores = new Map<string, ManagedSnapshotStore>();
  private readonly schedulers: InstanceRefreshScheduler[] = [];
  private readonly listeners = new Set<ManagedSnapshotListener>();
  /* The last reported state and reason per instance, so transitions log once. */
  private readonly lastReported = new Map<string, string>();
  private readonly validators: ManagedPayloadValidators;
  private telemetry: ManagedRuntimeTelemetry | undefined;

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    private readonly reader: ManagedSnapshotReader,
    @Inject(MANAGED_RUNTIME_CLOCK) private readonly clock: ManagedRuntimeClock,
  ) {
    this.settings = readManagedRuntimeSettings(configService);
    /* A bundled artifact that does not match its pin fails startup. */
    this.validators =
      this.settings.mode === ManagedConfigMode.Off
        ? new Map()
        : compileManagedPayloadValidators();
    for (const [appId, instanceId] of this.settings.instances) {
      this.stores.set(
        appId,
        new ManagedSnapshotStore(
          appId,
          instanceId,
          this.settings.maxStalenessMs,
        ),
      );
    }
  }

  get mode(): ManagedConfigMode {
    return this.settings.mode;
  }

  /** Whether `key` takes its value or policy from managed state. */
  isActiveKey(key: string): boolean {
    return this.settings.activeKeys.has(key);
  }

  /**
   * Captures the managed state `appId` reads now. Every evaluation calls this
   * once and reads only the returned view.
   */
  captureView(appId: string): ManagedResolutionView {
    const now = this.clock.now();
    const store = this.stores.get(appId);
    if (!store) {
      return { appId, state: ManagedConfigState.Unavailable, now };
    }
    return { appId, instanceId: store.instanceId, ...store.capture(now), now };
  }

  /** Counts one shadow-mode comparison result. */
  recordShadowComparison(
    instanceId: string,
    key: string,
    result: string,
  ): void {
    this.telemetry?.recordShadowComparison(instanceId, key, result);
  }

  /** Subscribes to accepted and re-verified snapshots; returns the unsubscribe. */
  onSnapshot(listener: ManagedSnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /*
   * One bounded attempt per instance before the server accepts requests; a
   * failure never blocks startup (`InstanceRefreshScheduler.start` resolves
   * by the read deadline at the latest).
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.settings.mode === ManagedConfigMode.Off) return;
    this.telemetry = createManagedRuntimeTelemetry(() =>
      [...this.stores.values()].map((store) => {
        const now = this.clock.now();
        const verifiedAt = store.lastVerification;
        return {
          instanceId: store.instanceId,
          state: store.capture(now).state,
          ...(verifiedAt != null
            ? { ageSeconds: (now - verifiedAt) / 1000 }
            : {}),
        };
      }),
    );
    for (const store of this.stores.values()) {
      this.schedulers.push(
        new InstanceRefreshScheduler(
          this.clock,
          this.settings.refreshIntervalMs,
          RUNTIME_READ_TIMEOUT_MS,
          {
            fetch: (signal) =>
              this.reader.read(store.instanceId, this.settings.apiKey, signal),
            apply: (result, durationMs) =>
              this.apply(store, result, durationMs),
            onLateDiscarded: () =>
              this.telemetry?.recordRefresh(
                store.instanceId,
                ManagedRefreshOutcome.LateDiscarded,
              ),
          },
        ),
      );
    }
    await Promise.all(this.schedulers.map((scheduler) => scheduler.start()));
  }

  onModuleDestroy(): void {
    for (const scheduler of this.schedulers) scheduler.stop();
    this.telemetry?.dispose();
  }

  private apply(
    store: ManagedSnapshotStore,
    result: RuntimeReadResult,
    durationMs: number,
  ): boolean {
    const applied = this.applyToStore(store, result);
    this.telemetry?.recordRefresh(
      store.instanceId,
      applied.outcome,
      durationMs,
    );
    this.reportTransition(store, applied);
    return applied.succeeded;
  }

  private applyToStore(
    store: ManagedSnapshotStore,
    result: RuntimeReadResult,
  ): AppliedResult {
    switch (result.kind) {
      case RuntimeReadKind.Candidate: {
        const acceptance = acceptSnapshot(result.body, {
          appId: store.appId,
          instanceId: store.instanceId,
          environment: this.settings.environment,
          knownRevision: (revisionId) => store.knownRevision(revisionId),
          validators: this.validators,
        });
        if (!acceptance.accepted) {
          store.recordFailure();
          return this.rejected(acceptance.reason);
        }
        const outcome = store.recordAccepted(
          acceptance.snapshot,
          this.clock.now(),
        );
        this.notify(acceptance.snapshot);
        return { succeeded: true, outcome };
      }
      case RuntimeReadKind.NotPublished:
        store.recordNotPublished();
        return { succeeded: true, outcome: ManagedRefreshOutcome.NotPublished };
      case RuntimeReadKind.Denied:
        store.recordFailure();
        return {
          succeeded: false,
          outcome: ManagedRefreshOutcome.Denied,
          reason: RuntimeReadKind.Denied,
        };
      case RuntimeReadKind.IntegrityMismatch:
        store.recordFailure();
        return this.rejected(ManagedRejectionReason.IntegrityMismatch);
      case RuntimeReadKind.Malformed:
        store.recordFailure();
        return this.rejected(ManagedRejectionReason.Malformed);
      case RuntimeReadKind.Unavailable:
      case RuntimeReadKind.Aborted:
        store.recordFailure();
        return {
          succeeded: false,
          outcome: ManagedRefreshOutcome.Unavailable,
          reason: RuntimeReadKind.Unavailable,
        };
    }
  }

  private rejected(reason: ManagedRejectionReason): AppliedResult {
    return {
      succeeded: false,
      outcome: `${ManagedRefreshOutcome.Rejected}_${reason}`,
      reason,
    };
  }

  private notify(snapshot: ManagedSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        this.logger.warn(
          `A managed snapshot listener failed for instance ${snapshot.instanceId}: ${String(error)}`,
        );
      }
    }
  }

  /*
   * Logs a change of state or failure reason once: an error for a denied key
   * or a rejection, a warning for degraded or stale state, and a log line on
   * recovery. Never logs a payload, value, role or credential.
   */
  private reportTransition(
    store: ManagedSnapshotStore,
    applied: AppliedResult,
  ): void {
    const { state } = store.capture(this.clock.now());
    const revision = store.activeRevisionId ?? 'none';
    const signature = `${state}:${applied.reason ?? ''}:${applied.succeeded ? revision : ''}`;
    if (this.lastReported.get(store.instanceId) === signature) return;
    this.lastReported.set(store.instanceId, signature);

    const message = `Managed configuration of instance ${store.instanceId}: state ${state}, revision ${revision}${applied.reason ? `, reason ${applied.reason}` : ''}`;
    if (applied.reason === RuntimeReadKind.Denied) {
      this.logger.error(
        `${message}. Core refused the reader key; check that its roles are in the instance's readerRoles`,
      );
    } else if (applied.outcome.startsWith(ManagedRefreshOutcome.Rejected)) {
      this.logger.error(message);
    } else if (
      state === ManagedConfigState.Degraded ||
      state === ManagedConfigState.Stale ||
      state === ManagedConfigState.Unavailable
    ) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
