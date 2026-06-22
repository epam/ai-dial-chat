import { Injectable, Logger } from '@nestjs/common';
import type { AppConfigEvalContext, ConfigProvider } from '../app-config.types';
import { CONFIG_DEFINITIONS } from './config-registry.constants';
import { EnvConfigProvider } from './env-config.provider';
import { StaticDefaultsProvider } from './static-defaults.provider';

/**
 * Provider priority order (index 0 = highest priority):
 *   0. EnvConfigProvider      — reads validated EnvironmentVariables via ConfigService
 *   1. (future) ManagedConfigProvider — dial-admin or compatible external config store
 *   2. (future) OpenFeatureProviderAdapter — targeting, rollout, experiments
 *   3. StaticDefaultsProvider — returns the registry defaultValue
 *
 * To add a new provider, insert it at the desired index and register it in AppConfigModule.
 * The first provider to return a non-undefined value wins; errors are swallowed per-provider.
 */
@Injectable()
export class CompositeConfigProvider {
  private readonly logger = new Logger(CompositeConfigProvider.name);

  constructor(
    private readonly envProvider: EnvConfigProvider,
    private readonly staticProvider: StaticDefaultsProvider,
  ) {}

  get providers(): ConfigProvider[] {
    // Slot 1: ManagedConfigProvider (disabled stub — activate when an implementation is provided)
    // Slot 2: OpenFeatureProviderAdapter (future)
    return [this.envProvider, this.staticProvider];
  }

  async resolve(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    const isCritical = definition?.critical ?? false;

    for (const provider of this.providers) {
      const providerName = provider.constructor.name;
      try {
        const value = await provider.resolve(key, context);
        if (value !== undefined) {
          this.logger.debug(`Key "${key}" resolved by ${providerName}`);
          return value;
        }
        this.logger.debug(
          `Key "${key}" not resolved by ${providerName}, falling through`,
        );
      } catch (err) {
        if (isCritical) {
          this.logger.error(
            `Provider ${providerName} threw for critical key "${key}": ${String(err)}`,
          );
        } else {
          this.logger.warn(
            `Provider ${providerName} threw for key "${key}": ${String(err)}`,
          );
        }
      }
    }

    this.logger.debug(
      `Key "${key}" not resolved by any provider, returning undefined`,
    );
    return undefined;
  }
}
