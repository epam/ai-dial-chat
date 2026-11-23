import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import { validate } from '../../../config/validation';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';
import { PINNED_MANAGED_CONFIG_SCHEMA_SHA256 } from '../../managed-config/managed-config.constants';
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

const HINT = { id: 'tour.start', target: 'new-chat', title: 'Start here' };

const MANAGED_KEYS = [
  'announcement.title',
  'announcement.description',
  'announcement.items',
  'onboarding.hints',
  'welcomeScreen.description',
  'ui.activeEventId',
  'ui.celebrationsEnabledByDefault',
  'ui.celebrationDelivery.mode',
  'ui.celebrationDelivery.revision',
  'ui.celebrationDelivery.externalScenes',
  'ui.celebrationDelivery.externalEvents',
  'fileManager.availableTabs',
  'features.usageLimitsControl',
  'usageLimits.warningThresholdPercent',
  'usageLimits.spendingLimitsMode',
];

const acceptedSnapshot = (
  payload: Record<string, unknown>,
  envelope: Record<string, unknown> = {},
) => {
  const result = acceptSnapshot(snapshotBody({ payload, ...envelope }), {
    appId: 'ai-dial-chat',
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
    expect(comparisons.map((comparison) => comparison.key)).toEqual(
      MANAGED_KEYS,
    );
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
        { config: { 'onboarding.hints': [HINT] }, features: {} },
        'onboarding.hints',
      ),
    ).resolves.toBe(ShadowComparisonResult.Differs);
  });

  it('reports a managed value equal to the effective one after normalization', async () => {
    const { comparator } = makeComparator();
    await expect(
      resultOf(
        comparator,
        { config: { 'onboarding.hints': [] }, features: {} },
        'onboarding.hints',
      ),
    ).resolves.toBe(ShadowComparisonResult.Equal);
  });

  it('reports an explicit environment value that would shadow the managed one', async () => {
    const { comparator } = makeComparator({
      ONBOARDING_HINTS: JSON.stringify([{ ...HINT, title: 'Local' }]),
    });
    await expect(
      resultOf(
        comparator,
        { config: { 'onboarding.hints': [HINT] }, features: {} },
        'onboarding.hints',
      ),
    ).resolves.toBe(ShadowComparisonResult.EnvShadowed);
  });

  it('compares every key of the build for a 1.0.0 snapshot', async () => {
    const { comparator } = makeComparator();
    const comparisons = await comparator.compare(
      acceptedSnapshot(
        { config: { 'onboarding.hints': [HINT] }, features: {} },
        {
          schemaVersion: '1.0.0',
          schemaSha256: PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.0.0'],
        },
      ),
    );
    expect(comparisons).toHaveLength(15);
    expect(
      comparisons.filter(
        (comparison) => comparison.result !== ShadowComparisonResult.Absent,
      ),
    ).toEqual([
      { key: 'onboarding.hints', result: ShadowComparisonResult.Differs },
    ]);
  });

  it('reports the five 1.2.0 keys as absent for a 1.1.0 snapshot', async () => {
    const { comparator } = makeComparator();
    const comparisons = await comparator.compare(
      acceptedSnapshot(
        { config: { 'announcement.title': 'Maintenance' }, features: {} },
        {
          schemaVersion: '1.1.0',
          schemaSha256: PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.1.0'],
        },
      ),
    );
    expect(comparisons).toHaveLength(15);
    expect(
      comparisons
        .filter(
          (comparison) => comparison.result === ShadowComparisonResult.Absent,
        )
        .map((comparison) => comparison.key),
    ).toEqual(
      expect.arrayContaining([
        'welcomeScreen.description',
        'fileManager.availableTabs',
        'features.usageLimitsControl',
        'usageLimits.warningThresholdPercent',
        'usageLimits.spendingLimitsMode',
      ]),
    );
  });

  it('reports a reordered tab list as equal to the same set', async () => {
    const { comparator } = makeComparator({
      FILE_MANAGER_AVAILABLE_TABS: 'my_files,organization',
    });
    await expect(
      resultOf(
        comparator,
        {
          config: { 'fileManager.availableTabs': ['organization', 'my_files'] },
          features: {},
        },
        'fileManager.availableTabs',
      ),
    ).resolves.toBe(ShadowComparisonResult.EnvShadowed);
    const { comparator: unshadowed } = makeComparator();
    await expect(
      resultOf(
        unshadowed,
        {
          config: {
            'fileManager.availableTabs': [
              'organization',
              'shared',
              'my_files',
              'all',
            ],
          },
          features: {},
        },
        'fileManager.availableTabs',
      ),
    ).resolves.toBe(ShadowComparisonResult.Equal);
  });

  it('reports an explicit spending mode that would shadow the published one', async () => {
    const { comparator } = makeComparator({ SPENDING_LIMITS_MODE: 'enforce' });
    await expect(
      resultOf(
        comparator,
        {
          config: { 'usageLimits.spendingLimitsMode': 'off' },
          features: {},
        },
        'usageLimits.spendingLimitsMode',
      ),
    ).resolves.toBe(ShadowComparisonResult.EnvShadowed);
  });

  it('reports a published event shadowed by the environment', async () => {
    const { comparator } = makeComparator({ UI_EVENT: 'halloween' });
    await expect(
      resultOf(
        comparator,
        { config: { 'ui.activeEventId': 'new-year' }, features: {} },
        'ui.activeEventId',
      ),
    ).resolves.toBe(ShadowComparisonResult.EnvShadowed);
  });

  it('does not let a malformed environment list shadow a published one', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { comparator } = makeComparator({
      ANNOUNCEMENTS: '[{"title":"A"},"title":"B"}]',
    });
    await expect(
      resultOf(
        comparator,
        { config: { 'announcement.items': [{ title: 'A' }] }, features: {} },
        'announcement.items',
      ),
    ).resolves.toBe(ShadowComparisonResult.Differs);
    await expect(
      resultOf(
        comparator,
        { config: { 'announcement.items': [] }, features: {} },
        'announcement.items',
      ),
    ).resolves.toBe(ShadowComparisonResult.Equal);
  });

  it('subscribes in shadow mode and logs one summary per revision without values', async () => {
    const clock = createFakeClock();
    const fake = createFakeReader();
    const body = snapshotBody({
      payload: {
        config: {
          'onboarding.hints': [{ ...HINT, title: 'Secret welcome' }],
        },
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
      'onboarding.hints',
      ShadowComparisonResult.Differs,
    );
    /* Fifteen managed keys, compared at startup and after one interval. */
    expect(record).toHaveBeenCalledTimes(30);
    const summaries = log.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.startsWith('Shadow comparison'));
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toContain('differs=[onboarding.hints]');
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
