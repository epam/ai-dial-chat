import { Injectable, Logger } from '@nestjs/common';
import type { AppConfigEvalContext, ConfigProvider } from '../app-config.types';
import { ManagedConfigProvider } from '../managed-runtime/managed-config.provider';
import { CONFIG_DEFINITIONS } from './config-registry.constants';
import { EnvConfigProvider } from './env-config.provider';
import { StaticDefaultsProvider } from './static-defaults.provider';

/**
 * Provider priority order (index 0 = highest priority):
 *   0. EnvConfigProvider      — validated EnvironmentVariables, only for
 *      variables the operator set explicitly
 *   1. ManagedConfigProvider  — the published Config Studio value of an
 *      active key, from the snapshot captured for this evaluation
 *   2. StaticDefaultsProvider — the registry defaultValue
 *
 * The first provider to return a non-undefined value wins; errors are
 * swallowed per provider, so a failing managed source falls through to the
 * registry default (managed features are additionally gated after selection).
 */
@Injectable()
export class CompositeConfigProvider {
  private readonly logger = new Logger(CompositeConfigProvider.name);

  constructor(
    private readonly envProvider: EnvConfigProvider,
    private readonly staticProvider: StaticDefaultsProvider,
    private readonly managedProvider: ManagedConfigProvider,
  ) {}

  get providers(): ConfigProvider[] {
    return [this.envProvider, this.managedProvider, this.staticProvider];
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
