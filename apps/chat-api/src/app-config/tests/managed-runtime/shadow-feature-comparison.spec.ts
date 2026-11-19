import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import { validate } from '../../../config/validation';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';
import { ManagedConfigMode } from '../../managed-runtime/managed-runtime.types';
import {
  ManagedShadowComparator,
  ShadowComparisonResult,
} from '../../managed-runtime/shadow-comparison';
import {
  acceptSnapshot,
  compileManagedPayloadValidators,
} from '../../managed-runtime/snapshot-acceptance';
import {
  createFakeClock,
  createManagedRuntime,
  MANAGED_ENVIRONMENT,
  snapshotBody,
} from './managed-runtime.fixtures';

/* Schema 1.0.0 manages no feature, so the feature comparison runs on the
 * test-only contract (see test-managed-contract.fixtures.ts). */
vi.mock(
  '../../config-registry/config-registry.constants',
  async (importOriginal) =>
    (
      await import('../managed-config/test-managed-contract.fixtures')
    ).withTestManagedRegistry(await importOriginal()),
);
vi.mock('../../managed-runtime/snapshot-acceptance', async (importOriginal) =>
  (
    await import('../managed-config/test-managed-contract.fixtures')
  ).withTestManagedValidators(
    await importOriginal(),
    (await import('../../config-registry/config-registry.constants'))
      .CONFIG_DEFINITIONS,
  ),
);

const REQUIRED = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};
const FEATURE = 'features.usageLimitsControl';

const makeComparator = () => {
  const configService = new ConfigService<EnvironmentVariables>(
    validate(REQUIRED),
  );
  return new ManagedShadowComparator(
    createManagedRuntime({
      ...MANAGED_ENVIRONMENT,
      MANAGED_CONFIG_MODE: ManagedConfigMode.Shadow,
    }),
    new EnvConfigProvider(
      configService,
      ExplicitEnvironment.fromConfigService(configService),
    ),
    configService,
    createFakeClock(),
  );
};

const featureResult = async (
  comparator: ManagedShadowComparator,
  state: Record<string, unknown>,
) => {
  const result = acceptSnapshot(
    snapshotBody({ payload: { config: {}, features: { [FEATURE]: state } } }),
    {
      appId: 'ai-dial-chat',
      instanceId: 'chat-dev',
      knownRevision: () => undefined,
      validators: compileManagedPayloadValidators(),
    },
  );
  if (!result.accepted) throw new Error(`fixture rejected: ${result.reason}`);
  return (await comparator.compare(result.snapshot)).find(
    (comparison) => comparison.key === FEATURE,
  )?.result;
};

describe('ManagedShadowComparator with a managed feature', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compares a managed feature through its gates for an anonymous caller', async () => {
    const comparator = makeComparator();
    await expect(featureResult(comparator, { enabled: false })).resolves.toBe(
      ShadowComparisonResult.Equal,
    );
    await expect(featureResult(comparator, { enabled: true })).resolves.toBe(
      ShadowComparisonResult.Differs,
    );
    await expect(
      featureResult(comparator, {
        enabled: true,
        targeting: { roles: ['beta'] },
      }),
    ).resolves.toBe(ShadowComparisonResult.Equal);
  });
});
