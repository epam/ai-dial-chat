import type { ValidateFunction } from 'ajv';
import type { ConfigDefinition } from '../../app-config.types';
import {
  managedConfigKey,
  managedFeatureKey,
} from '../../managed-config/key-management';
import { buildManagedConfigSchema } from '../../managed-config/managed-config-schema';
import { MANAGED_CONFIG_SCHEMA_VERSION } from '../../managed-config/managed-config.constants';
import {
  ManagedSchemaType,
  type KeyManagement,
} from '../../managed-config/managed-config.types';
import { createStudioAjv } from './studio-contract.fixtures';

/*
 * A managed contract for tests only. Schema 1.0.0 manages only
 * `onboarding.hints`, so it reaches neither a managed feature (policies,
 * availability windows, targeting, FeatureGuard) nor a second managed config
 * key. Tests of those mechanisms mark the eligible keys below managed on top
 * of the real registry and validate payloads against a schema generated from
 * that registry. Snapshots still carry the real 1.0.0 version and pin. The
 * contract is never committed as an artifact; schema 1.1.0 exports these keys
 * with their real value schemas.
 *
 * A spec opts in with two hoisted mocks:
 *
 *   vi.mock('…/config-registry/config-registry.constants', async (original) =>
 *     (await import('…/test-managed-contract.fixtures')).withTestManagedRegistry(
 *       await original(),
 *     ),
 *   );
 *   vi.mock('…/managed-runtime/snapshot-acceptance', async (original) =>
 *     (await import('…/test-managed-contract.fixtures')).withTestManagedValidators(
 *       await original(),
 *       (await import('…/config-registry/config-registry.constants'))
 *         .CONFIG_DEFINITIONS,
 *     ),
 *   );
 */

/** The eligible keys the test contract manages besides `onboarding.hints`. */
export const TEST_MANAGED_KEYS: Readonly<Record<string, KeyManagement>> = {
  'announcement.description': managedConfigKey({
    title: 'Announcement description',
    description: 'Test-only managed text.',
    order: 11,
    value: {
      type: ManagedSchemaType.String,
      minLength: 1,
      maxLength: 2000,
      pattern: '\\S',
    },
  }),
  'welcomeScreen.description': managedConfigKey({
    title: 'Welcome text',
    description: 'Test-only managed text.',
    order: 20,
    value: {
      type: ManagedSchemaType.String,
      minLength: 1,
      maxLength: 1000,
      pattern: '\\S',
    },
  }),
  'usageLimits.warningThresholdPercent': managedConfigKey({
    title: 'Usage warning threshold (%)',
    description: 'Test-only managed number.',
    order: 40,
    value: { type: ManagedSchemaType.Integer, minimum: 1, maximum: 99 },
  }),
  'features.usageLimitsControl': managedFeatureKey({
    title: 'Usage-limits control',
    description: 'Test-only managed feature.',
    order: 1,
  }),
};

/** `definitions` with the test-contract keys marked managed. */
export const withTestManagedKeys = (
  definitions: readonly ConfigDefinition[],
): ConfigDefinition[] =>
  definitions.map((definition) => {
    const management = TEST_MANAGED_KEYS[definition.key];
    return management ? { ...definition, management } : definition;
  });

/** Validators of the schema generated from `definitions`, as the current version. */
export const compileTestManagedPayloadValidators = (
  definitions: readonly ConfigDefinition[],
): ReadonlyMap<string, ValidateFunction> =>
  new Map([
    [
      MANAGED_CONFIG_SCHEMA_VERSION,
      createStudioAjv().compile(
        buildManagedConfigSchema(
          [...definitions],
          MANAGED_CONFIG_SCHEMA_VERSION,
        ),
      ),
    ],
  ]);

/** The registry module with the test-contract keys marked managed. */
export const withTestManagedRegistry = (actual: unknown): object => {
  const registry = actual as { CONFIG_DEFINITIONS: ConfigDefinition[] };
  return {
    ...registry,
    CONFIG_DEFINITIONS: withTestManagedKeys(registry.CONFIG_DEFINITIONS),
  };
};

/**
 * The snapshot-acceptance module, validating against `definitions` (the
 * mocked registry, which the spec's mock factory imports).
 */
export const withTestManagedValidators = (
  actual: unknown,
  definitions: readonly ConfigDefinition[],
): object => ({
  ...(actual as object),
  compileManagedPayloadValidators: () =>
    compileTestManagedPayloadValidators(definitions),
});
