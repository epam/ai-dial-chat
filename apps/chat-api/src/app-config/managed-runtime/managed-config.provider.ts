import { Injectable } from '@nestjs/common';
import type { AppConfigEvalContext, ConfigProvider } from '../app-config.types';
import { CONFIG_DEFINITIONS } from '../config-registry/config-registry.constants';
import { MANAGED_CONFIG_APP_ID } from '../managed-config/managed-config.constants';
import {
  readManagedConfigValue,
  readManagedFeatureState,
} from './managed-evaluation';
import { ManagedRuntimeService } from './managed-runtime.service';
import { ManagedConfigMode } from './managed-runtime.types';

/**
 * Slot 1 of `CompositeConfigProvider`: the published Config Studio value of
 * an active key, read only from the view `AppConfigService` captured for
 * this evaluation. It sits after `EnvConfigProvider`, which answers only for
 * explicitly present variables, and before the registry default, so a value
 * resolves as explicit ENV → managed → default. For a feature it supplies
 * only the enabled bit; the policy gates run after selection. Only a
 * `ai-dial-chat` snapshot feeds the typed keys: another application's payload is
 * delivered unchanged as `appConfig` and never read here.
 */
@Injectable()
export class ManagedConfigProvider implements ConfigProvider {
  constructor(private readonly managedRuntime: ManagedRuntimeService) {}

  async resolve(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    const snapshot = context.managed?.snapshot;
    if (
      context.managed?.appId !== MANAGED_CONFIG_APP_ID ||
      this.managedRuntime.mode !== ManagedConfigMode.Active ||
      !this.managedRuntime.isActiveKey(key) ||
      !snapshot
    ) {
      return undefined;
    }
    const definition = CONFIG_DEFINITIONS.find((entry) => entry.key === key);
    if (definition?.type === 'feature') {
      return readManagedFeatureState(snapshot, key)?.enabled;
    }
    return readManagedConfigValue(snapshot, key);
  }
}
