import type { ConfigService } from '@nestjs/config';
import { DEFAULT_CLIENT_CONFIG_APP_IDS } from '../../config/env/client-ui.env';
import type { EnvironmentVariables } from '../../config/environment.config';
import { CONFIG_DEFINITIONS } from '../config-registry/config-registry.constants';
import { isManagedKey } from '../managed-config/key-management';
import { ManagedConfigMode } from './managed-runtime.types';

/** The validated managed-configuration settings of this deployment. */
export interface ManagedRuntimeSettings {
  readonly mode: ManagedConfigMode;
  /** Served application identifier → Config Studio instance ID. */
  readonly instances: ReadonlyMap<string, string>;
  /** The reader key; empty only while the mode is `off`. */
  readonly apiKey: string;
  readonly maxStalenessMs: number;
  readonly refreshIntervalMs: number;
  readonly clientRefreshMs: number;
  /** Keys whose managed value or policy applies; empty unless `active`. */
  readonly activeKeys: ReadonlySet<string>;
  readonly environment?: string;
}

/** The smallest maximum staleness, in refresh intervals. */
export const MIN_STALENESS_INTERVALS = 3;

type ManagedEnvironmentInput = Pick<
  EnvironmentVariables,
  | 'MANAGED_CONFIG_MODE'
  | 'MANAGED_CONFIG_INSTANCES'
  | 'MANAGED_CONFIG_API_KEY'
  | 'MANAGED_CONFIG_MAX_STALENESS_SECONDS'
  | 'MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS'
  | 'MANAGED_CONFIG_ACTIVE_KEYS'
  | 'CLIENT_CONFIG_APP_IDS'
>;

const splitPair = (pair: string): [string, string] => {
  const separator = pair.indexOf('=');
  return [pair.slice(0, separator), pair.slice(separator + 1)];
};

/**
 * The rules that relate the managed-configuration variables to each other
 * and to `CLIENT_CONFIG_APP_IDS`, checked after class validation. Returns
 * one message per broken rule; every message names its variable and never
 * prints a configured value other than a registry key.
 */
export const validateManagedRuntimeEnvironment = (
  config: ManagedEnvironmentInput,
): string[] => {
  const mode = config.MANAGED_CONFIG_MODE ?? ManagedConfigMode.Off;
  const activeKeys = config.MANAGED_CONFIG_ACTIVE_KEYS ?? [];
  const errors: string[] = [];

  /* Outside `active` the key list is ignored (ManagedRuntimeService warns),
   * so turning the mode back is a one-variable rollback. */
  if (mode === ManagedConfigMode.Off) {
    return errors;
  }

  const pairs = (config.MANAGED_CONFIG_INSTANCES ?? []).map(splitPair);
  if (pairs.length === 0) {
    errors.push(
      'MANAGED_CONFIG_INSTANCES is required when MANAGED_CONFIG_MODE is not off',
    );
  }
  const served = new Set(
    config.CLIENT_CONFIG_APP_IDS?.length
      ? config.CLIENT_CONFIG_APP_IDS
      : DEFAULT_CLIENT_CONFIG_APP_IDS,
  );
  const appIds = pairs.map(([appId]) => appId);
  const instanceIds = pairs.map(([, instanceId]) => instanceId);
  if (appIds.some((appId) => !served.has(appId))) {
    errors.push(
      'MANAGED_CONFIG_INSTANCES may only map application identifiers listed in CLIENT_CONFIG_APP_IDS',
    );
  }
  if (new Set(appIds).size !== appIds.length) {
    errors.push(
      'MANAGED_CONFIG_INSTANCES maps an application identifier twice',
    );
  }
  if (new Set(instanceIds).size !== instanceIds.length) {
    errors.push('MANAGED_CONFIG_INSTANCES maps an instance twice');
  }

  if (!config.MANAGED_CONFIG_API_KEY?.trim()) {
    errors.push(
      'MANAGED_CONFIG_API_KEY is required when MANAGED_CONFIG_MODE is not off',
    );
  }

  const interval = config.MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS ?? 60;
  const staleness = config.MANAGED_CONFIG_MAX_STALENESS_SECONDS;
  if (staleness == null) {
    errors.push(
      'MANAGED_CONFIG_MAX_STALENESS_SECONDS is required when MANAGED_CONFIG_MODE is not off',
    );
  } else if (staleness < MIN_STALENESS_INTERVALS * interval) {
    errors.push(
      `MANAGED_CONFIG_MAX_STALENESS_SECONDS must be at least ${MIN_STALENESS_INTERVALS} times MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS`,
    );
  }

  for (const key of mode === ManagedConfigMode.Active ? activeKeys : []) {
    const definition = CONFIG_DEFINITIONS.find((entry) => entry.key === key);
    if (!definition || !isManagedKey(definition)) {
      errors.push(
        `MANAGED_CONFIG_ACTIVE_KEYS lists "${key}", which is not a managed key`,
      );
    }
  }
  return errors;
};

/** The keys listed in `MANAGED_CONFIG_ACTIVE_KEYS`, whatever the mode. */
export const readConfiguredActiveKeys = (
  configService: ConfigService<EnvironmentVariables>,
): readonly string[] =>
  configService.get('MANAGED_CONFIG_ACTIVE_KEYS', { infer: true }) ?? [];

/** Reads the settings `validateManagedRuntimeEnvironment` already accepted. */
export const readManagedRuntimeSettings = (
  configService: ConfigService<EnvironmentVariables>,
): ManagedRuntimeSettings => {
  const mode =
    configService.get('MANAGED_CONFIG_MODE', { infer: true }) ??
    ManagedConfigMode.Off;
  const pairs =
    mode === ManagedConfigMode.Off
      ? []
      : (configService.get('MANAGED_CONFIG_INSTANCES', { infer: true }) ?? []);
  const seconds = (value: number | undefined, fallback: number): number =>
    (value ?? fallback) * 1000;
  return {
    mode,
    instances: new Map(pairs.map(splitPair)),
    apiKey:
      configService.get('MANAGED_CONFIG_API_KEY', { infer: true })?.trim() ??
      '',
    maxStalenessMs: seconds(
      configService.get('MANAGED_CONFIG_MAX_STALENESS_SECONDS', {
        infer: true,
      }),
      0,
    ),
    refreshIntervalMs: seconds(
      configService.get('MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS', {
        infer: true,
      }),
      60,
    ),
    clientRefreshMs: seconds(
      configService.get('MANAGED_CONFIG_CLIENT_REFRESH_SECONDS', {
        infer: true,
      }),
      120,
    ),
    activeKeys: new Set(
      mode === ManagedConfigMode.Active
        ? (configService.get('MANAGED_CONFIG_ACTIVE_KEYS', { infer: true }) ??
            [])
        : [],
    ),
    environment:
      configService.get('MANAGED_CONFIG_ENVIRONMENT', { infer: true }) ||
      undefined,
  };
};
