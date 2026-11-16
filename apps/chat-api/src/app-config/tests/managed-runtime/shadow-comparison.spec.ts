import { Logger } from '@nestjs/common';
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
import { RuntimeReadKind } from '../../managed-runtime/snapshot-reader';
import {
  createFakeClock,
  createFakeReader,
  createManagedRuntime,
  MANAGED_ENVIRONMENT,
  snapshotBody,
} from './managed-runtime.fixtures';

const REQUIRED = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

const acceptedSnapshot = (payload: Record<string, unknown>) => {
  const result = acceptSnapshot(snapshotBody({ payload }), {
    appId: 'chat-ui',
    instanceId: 'chat-dev',
    knownRevision: () => undefined,
    validators: compileManagedPayloadValidators(),
  });
  if (!result.accepted) throw new Error(`fixture rejected: ${result.reason}`);
  return result.snapshot;
};

const makeComparator = (raw: Record<string, unknown> = {}) => {
  const configService = new ConfigService<EnvironmentVariables>(
    validate({ ...REQUIRED, ...raw }),
  );
  const envProvider = new EnvConfigProvider(
    configService,
    ExplicitEnvironment.fromConfigService(configService),
  );
  const runtime = createManagedRuntime({
    ...MANAGED_ENVIRONMENT,
    MANAGED_CONFIG_MODE: ManagedConfigMode.Shadow,
  });
  return {
    runtime,
    comparator: new ManagedShadowComparator(
      runtime,
      envProvider,
      configService,
      createFakeClock(),
    ),
  };
};

const resultOf = async (
  comparator: ManagedShadowComparator,
  payload: Record<string, unknown>,
  key: string,
) =>
  (await comparator.compare(acceptedSnapshot(payload))).find(
    (comparison) => comparison.key === key,
  )?.result;

describe('ManagedShadowComparator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compares every managed key', async () => {
    const { comparator } = makeComparator();
    const comparisons = await comparator.compare(
      acceptedSnapshot({ config: {}, features: {} }),
    );
    expect(comparisons.map((comparison) => comparison.key).sort()).toEqual([
      'announcement.description',
      'announcement.items',
      'announcement.title',
      'features.usageLimitsControl',
      'fileManager.availableTabs',
      'usageLimits.warningThresholdPercent',
      'welcomeScreen.description',
    ]);
    expect(
      comparisons.every(
        (comparison) => comparison.result === ShadowComparisonResult.Absent,
      ),
    ).toBe(true);
  });

  it('reports a managed value that would change the response', async () => {
    const { comparator } = makeComparator();
    await expect(
      resultOf(
        comparator,
        { config: { 'welcomeScreen.description': 'Hello' }, features: {} },
        'welcomeScreen.description',
      ),
    ).resolves.toBe(ShadowComparisonResult.Differs);
  });

  it('reports a managed value equal to the effective one after normalization', async () => {
    const { comparator } = makeComparator();
    await expect(
      resultOf(
        comparator,
        { config: { 'usageLimits.warningThresholdPercent': 75 }, features: {} },
        'usageLimits.warningThresholdPercent',
      ),
    ).resolves.toBe(ShadowComparisonResult.Equal);
  });

  it('reports an explicit environment value that would shadow the managed one', async () => {
    const { comparator } = makeComparator({ ANNOUNCEMENT_TITLE: 'Local' });
    await expect(
      resultOf(
        comparator,
        { config: { 'announcement.title': 'Managed' }, features: {} },
        'announcement.title',
      ),
    ).resolves.toBe(ShadowComparisonResult.EnvShadowed);
  });

  it('compares a managed feature through its gates for an anonymous caller', async () => {
    const { comparator } = makeComparator();
    const feature = (state: Record<string, unknown>) =>
      resultOf(
        comparator,
        { config: {}, features: { 'features.usageLimitsControl': state } },
        'features.usageLimitsControl',
      );
    await expect(feature({ enabled: false })).resolves.toBe(
      ShadowComparisonResult.Equal,
    );
    await expect(feature({ enabled: true })).resolves.toBe(
      ShadowComparisonResult.Differs,
    );
    await expect(
      feature({ enabled: true, targeting: { roles: ['beta'] } }),
    ).resolves.toBe(ShadowComparisonResult.Equal);
  });

  it('subscribes in shadow mode and logs one summary per revision without values', async () => {
    const clock = createFakeClock();
    const fake = createFakeReader();
    const body = snapshotBody({
      payload: {
        config: { 'welcomeScreen.description': 'Secret welcome' },
        features: {},
      },
    });
    fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Candidate, body });
    const runtime = createManagedRuntime(
      { ...MANAGED_ENVIRONMENT, MANAGED_CONFIG_MODE: ManagedConfigMode.Shadow },
      fake.reader,
      clock,
    );
    const configService = new ConfigService<EnvironmentVariables>(
      validate(REQUIRED),
    );
    const comparator = new ManagedShadowComparator(
      runtime,
      new EnvConfigProvider(
        configService,
        ExplicitEnvironment.fromConfigService(configService),
      ),
      configService,
      clock,
    );
    const record = vi.spyOn(runtime, 'recordShadowComparison');
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    comparator.onModuleInit();
    await runtime.onApplicationBootstrap();
    await clock.advance(60_000);

    expect(record).toHaveBeenCalledWith(
      'chat-dev',
      'welcomeScreen.description',
      ShadowComparisonResult.Differs,
    );
    expect(record).toHaveBeenCalledTimes(14);
    const summaries = log.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.startsWith('Shadow comparison'));
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toContain('differs=[welcomeScreen.description]');
    expect(summaries[0]).not.toContain('Secret welcome');
    comparator.onModuleDestroy();
    runtime.onModuleDestroy();
  });

  it('does not subscribe outside shadow mode', () => {
    const runtime = createManagedRuntime({});
    const subscribe = vi.spyOn(runtime, 'onSnapshot');
    const configService = new ConfigService<EnvironmentVariables>(
      validate(REQUIRED),
    );
    new ManagedShadowComparator(
      runtime,
      new EnvConfigProvider(
        configService,
        ExplicitEnvironment.fromConfigService(configService),
      ),
      configService,
      createFakeClock(),
    ).onModuleInit();
    expect(subscribe).not.toHaveBeenCalled();
  });
});
