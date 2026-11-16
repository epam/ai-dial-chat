import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { ConfigDefinition } from '../app-config.types';
import {
  applyClientConfigValue,
  createDefaultClientConfig,
} from '../client-config.mapper';
import { CONFIG_DEFINITIONS } from '../config-registry/config-registry.constants';
import { EnvConfigProvider } from '../config-registry/env-config.provider';
import { applyDeploymentRoleGate } from '../deployment-role-gate';
import {
  isCapabilityAvailable,
  readCapabilityInputs,
} from '../feature-capabilities';
import { canonicalJson } from '../managed-config/canonical-json';
import { isManagedKey } from '../managed-config/key-management';
import { MANAGED_CONFIG_APP_ID } from '../managed-config/managed-config.constants';
import {
  isManagedFeatureEnabled,
  readManagedConfigValue,
  readManagedFeatureState,
} from './managed-evaluation';
import { ManagedRuntimeService } from './managed-runtime.service';
import {
  ManagedConfigMode,
  ManagedConfigState,
  type ManagedSnapshot,
} from './managed-runtime.types';
import {
  MANAGED_RUNTIME_CLOCK,
  type ManagedRuntimeClock,
} from './refresh-scheduler';

/** How a managed key's snapshot value relates to its effective legacy value. */
export enum ShadowComparisonResult {
  /** Applying the snapshot would not change what callers see. */
  Equal = 'equal',
  /** Applying the snapshot would change what callers see. */
  Differs = 'differs',
  /** An explicit environment value would still win over the snapshot. */
  EnvShadowed = 'env_shadowed',
  /** The snapshot supplies nothing for the key. */
  Absent = 'absent',
}

/** The shadow comparison of one key. */
export interface ShadowComparison {
  readonly key: string;
  readonly result: ShadowComparisonResult;
}

/* The client-config fields a config key produces, as comparable text. */
const normalizedClientValue = (key: string, resolved: unknown): string => {
  const config = createDefaultClientConfig();
  applyClientConfigValue(config, key, {
    resolved,
    appVersion: '',
    warn: () => undefined,
  });
  return canonicalJson(config);
};

const MANAGED_DEFINITIONS: readonly ConfigDefinition[] =
  CONFIG_DEFINITIONS.filter(isManagedKey);

/**
 * In `shadow` mode, compares every `chat-ui` managed key of each accepted
 * or re-verified snapshot with what callers see today, without changing any
 * response: config keys through the shared client-config normalization,
 * features through their gates for an anonymous caller. Results are counted
 * per key and logged once per revision, never with values.
 */
@Injectable()
export class ManagedShadowComparator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManagedShadowComparator.name);
  private unsubscribe: (() => void) | undefined;
  /* The last revision logged per instance. */
  private readonly loggedRevisions = new Map<string, string>();

  constructor(
    private readonly managedRuntime: ManagedRuntimeService,
    private readonly envProvider: EnvConfigProvider,
    private readonly configService: ConfigService<EnvironmentVariables>,
    @Inject(MANAGED_RUNTIME_CLOCK) private readonly clock: ManagedRuntimeClock,
  ) {}

  onModuleInit(): void {
    if (this.managedRuntime.mode !== ManagedConfigMode.Shadow) return;
    this.unsubscribe = this.managedRuntime.onSnapshot((snapshot) => {
      if (snapshot.appId !== MANAGED_CONFIG_APP_ID) return;
      void this.report(snapshot);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /** Compares every managed key of `snapshot`; exposed for tests. */
  async compare(snapshot: ManagedSnapshot): Promise<ShadowComparison[]> {
    const now = this.clock.now();
    const comparisons: ShadowComparison[] = [];
    for (const definition of MANAGED_DEFINITIONS) {
      comparisons.push({
        key: definition.key,
        result: await this.compareKey(definition, snapshot, now),
      });
    }
    return comparisons;
  }

  private async report(snapshot: ManagedSnapshot): Promise<void> {
    try {
      const comparisons = await this.compare(snapshot);
      for (const { key, result } of comparisons) {
        this.managedRuntime.recordShadowComparison(
          snapshot.instanceId,
          key,
          result,
        );
      }
      if (
        this.loggedRevisions.get(snapshot.instanceId) === snapshot.revisionId
      ) {
        return;
      }
      this.loggedRevisions.set(snapshot.instanceId, snapshot.revisionId);
      const summary = Object.values(ShadowComparisonResult)
        .map((result) => {
          const keys = comparisons
            .filter((comparison) => comparison.result === result)
            .map((comparison) => comparison.key);
          return `${result}=[${keys.join(', ')}]`;
        })
        .join(' ');
      this.logger.log(
        `Shadow comparison of instance ${snapshot.instanceId}, revision ${snapshot.revisionId}: ${summary}`,
      );
    } catch (error) {
      this.logger.warn(
        `Shadow comparison of instance ${snapshot.instanceId} failed: ${String(error)}`,
      );
    }
  }

  private async compareKey(
    definition: ConfigDefinition,
    snapshot: ManagedSnapshot,
    now: number,
  ): Promise<ShadowComparisonResult> {
    const { key } = definition;
    const isFeature = definition.type === 'feature';
    const managed = isFeature
      ? readManagedFeatureState(snapshot, key)
      : readManagedConfigValue(snapshot, key);
    if (managed === undefined) return ShadowComparisonResult.Absent;

    /* EnvConfigProvider answers only for explicitly present variables. */
    const explicit = await this.envProvider.resolve(key, {
      appId: MANAGED_CONFIG_APP_ID,
    });
    if (explicit !== undefined) return ShadowComparisonResult.EnvShadowed;

    if (!isFeature) {
      return normalizedClientValue(key, definition.defaultValue) ===
        normalizedClientValue(key, managed)
        ? ShadowComparisonResult.Equal
        : ShadowComparisonResult.Differs;
    }

    const allowedRoles = definition.allowedRolesEnvVar
      ? this.configService.get(definition.allowedRolesEnvVar, { infer: true })
      : undefined;
    const legacy = applyDeploymentRoleGate(
      definition.defaultValue,
      allowedRoles,
      undefined,
    );
    const managedEnabled = applyDeploymentRoleGate(
      isManagedFeatureEnabled({
        key,
        view: {
          appId: MANAGED_CONFIG_APP_ID,
          instanceId: snapshot.instanceId,
          state: ManagedConfigState.Fresh,
          snapshot,
          now,
        },
        configuredEnabled: readManagedFeatureState(snapshot, key)?.enabled,
        capabilityAvailable: isCapabilityAvailable(
          key,
          readCapabilityInputs(this.configService),
        ),
        roles: undefined,
      }),
      allowedRoles,
      undefined,
    );
    return (legacy === true) === (managedEnabled === true)
      ? ShadowComparisonResult.Equal
      : ShadowComparisonResult.Differs;
  }
}
