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

/* The feature comparison runs on features.usageLimitsControl, the managed
 * feature of the real 1.2.0 contract. */

const REQUIRED = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};
const FEATURE = 'features.usageLimitsControl';

const makeComparator = (raw: Record<string, unknown> = {}) => {
  const configService = new ConfigService<EnvironmentVariables>(
    validate({ ...REQUIRED, ...raw }),
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

  it('reports an explicit environment value that would shadow the published policy', async () => {
    const comparator = makeComparator({ USAGE_LIMITS_CONTROL_ENABLED: 'true' });
    await expect(featureResult(comparator, { enabled: false })).resolves.toBe(
      ShadowComparisonResult.EnvShadowed,
    );
  });
});
