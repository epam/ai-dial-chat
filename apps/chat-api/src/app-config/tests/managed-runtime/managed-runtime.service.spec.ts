import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { canonicalSha256 } from '../../managed-config/canonical-json';
import {
  ManagedConfigMode,
  ManagedConfigState,
} from '../../managed-runtime/managed-runtime.types';
import {
  RuntimeReadKind,
  type RuntimeReadResult,
} from '../../managed-runtime/snapshot-reader';
import {
  candidate,
  createFakeClock,
  createFakeReader,
  createManagedRuntime,
  MANAGED_ENVIRONMENT,
  snapshotBody,
} from './managed-runtime.fixtures';

const SHADOW = {
  ...MANAGED_ENVIRONMENT,
  MANAGED_CONFIG_MODE: ManagedConfigMode.Shadow,
};
const INTERVAL = 60_000;
const STALENESS = 900_000;

const revision = (revisionId: string, extra: Record<string, unknown> = {}) =>
  candidate({
    revisionId,
    sha256: canonicalSha256({ revisionId, ...extra }),
    ...extra,
  });

const unavailable: RuntimeReadResult = { kind: RuntimeReadKind.Unavailable };

describe('ManagedRuntimeService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = (environment: Partial<EnvironmentVariables> = SHADOW) => {
    const clock = createFakeClock();
    const fake = createFakeReader();
    const runtime = createManagedRuntime(environment, fake.reader, clock);
    return { clock, fake, runtime };
  };

  it('sends no request in off mode', async () => {
    const { clock, fake, runtime } = setup({});
    await runtime.onApplicationBootstrap();
    await clock.advance(3_600_000);
    expect(fake.calls).toEqual([]);
    expect(runtime.captureView('chat-ui')).toEqual({
      appId: 'chat-ui',
      state: ManagedConfigState.Unavailable,
      now: clock.now(),
    });
  });

  it('reads once at startup and accepts a valid snapshot', async () => {
    const { fake, runtime } = setup();
    fake.respond('chat-dev', revision('r1'));
    await runtime.onApplicationBootstrap();

    expect(fake.calls).toEqual(['chat-dev']);
    expect(runtime.captureView('chat-ui')).toMatchObject({
      instanceId: 'chat-dev',
      state: ManagedConfigState.Fresh,
      snapshot: expect.objectContaining({ revisionId: 'r1' }),
    });
    runtime.onModuleDestroy();
  });

  it('completes startup by the read deadline when Core is unreachable', async () => {
    const { clock, fake, runtime } = setup();
    fake.respond('chat-dev', new Promise(() => undefined));
    const bootstrap = runtime.onApplicationBootstrap();
    await clock.advance(5_000);
    await bootstrap;

    expect(runtime.captureView('chat-ui').state).toBe(
      ManagedConfigState.Unavailable,
    );
    expect(clock.pendingDelays()).toEqual([2 * INTERVAL]);
    runtime.onModuleDestroy();
  });

  it('keeps the snapshot through an outage within staleness, then fails closed', async () => {
    const { clock, fake, runtime } = setup();
    fake.respond('chat-dev', revision('r1'));
    fake.respondAlways('chat-dev', {
      kind: RuntimeReadKind.Unavailable,
      status: 503,
    });
    await runtime.onApplicationBootstrap();

    await clock.advance(5 * INTERVAL);
    expect(runtime.captureView('chat-ui')).toMatchObject({
      state: ManagedConfigState.Degraded,
      snapshot: expect.objectContaining({ revisionId: 'r1' }),
    });

    await clock.advance(STALENESS - 5 * INTERVAL);
    expect(runtime.captureView('chat-ui').state).toBe(
      ManagedConfigState.Degraded,
    );
    await clock.advance(1);
    const view = runtime.captureView('chat-ui');
    expect(view.state).toBe(ManagedConfigState.Stale);
    expect(view.snapshot).toBeUndefined();
    runtime.onModuleDestroy();
  });

  it('treats a denied key like an outage and logs an error', async () => {
    const { clock, fake, runtime } = setup();
    const error = vi.spyOn(Logger.prototype, 'error');
    fake.respond('chat-dev', revision('r1'));
    fake.respondAlways('chat-dev', {
      kind: RuntimeReadKind.Denied,
      status: 404,
    });
    await runtime.onApplicationBootstrap();

    await clock.advance(INTERVAL);
    expect(runtime.captureView('chat-ui').state).toBe(
      ManagedConfigState.Degraded,
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Core refused the reader key'),
    );
    await clock.advance(STALENESS);
    expect(runtime.captureView('chat-ui').state).toBe(ManagedConfigState.Stale);
    runtime.onModuleDestroy();
  });

  it('discards the snapshot when the instance is no longer published', async () => {
    const { clock, fake, runtime } = setup();
    fake.respond('chat-dev', revision('r1'));
    fake.respond('chat-dev', {
      kind: RuntimeReadKind.NotPublished,
      status: 404,
    });
    await runtime.onApplicationBootstrap();
    await clock.advance(INTERVAL);

    const view = runtime.captureView('chat-ui');
    expect(view.state).toBe(ManagedConfigState.NotPublished);
    expect(view.snapshot).toBeUndefined();
    runtime.onModuleDestroy();
  });

  it('keeps the previous snapshot on an integrity mismatch or an incompatible revision', async () => {
    const { clock, fake, runtime } = setup();
    fake.respond('chat-dev', revision('r1'));
    fake.respond('chat-dev', {
      kind: RuntimeReadKind.IntegrityMismatch,
      status: 502,
    });
    fake.respond('chat-dev', revision('r2', { schemaVersion: '9.0.0' }));
    await runtime.onApplicationBootstrap();

    await clock.advance(INTERVAL);
    expect(runtime.captureView('chat-ui').snapshot?.revisionId).toBe('r1');
    await clock.advance(2 * INTERVAL);
    expect(runtime.captureView('chat-ui')).toMatchObject({
      state: ManagedConfigState.Degraded,
      snapshot: expect.objectContaining({ revisionId: 'r1' }),
    });
    runtime.onModuleDestroy();
  });

  it('accepts a previously rejected revision once it passes', async () => {
    const { clock, fake, runtime } = setup();
    fake.respond('chat-dev', revision('r2', { instanceId: 'chat-prod' }));
    fake.respond('chat-dev', revision('r2'));
    await runtime.onApplicationBootstrap();
    expect(runtime.captureView('chat-ui').state).toBe(
      ManagedConfigState.Unavailable,
    );

    await clock.advance(2 * INTERVAL);
    expect(runtime.captureView('chat-ui')).toMatchObject({
      state: ManagedConfigState.Fresh,
      snapshot: expect.objectContaining({ revisionId: 'r2' }),
    });
    runtime.onModuleDestroy();
  });

  it('becomes fresh again when an outage ends on the same revision', async () => {
    const { clock, fake, runtime } = setup();
    const r1 = revision('r1');
    fake.respond('chat-dev', r1);
    fake.respond('chat-dev', unavailable);
    fake.respond('chat-dev', r1);
    await runtime.onApplicationBootstrap();
    const first = runtime.captureView('chat-ui').snapshot;

    await clock.advance(INTERVAL);
    expect(runtime.captureView('chat-ui').state).toBe(
      ManagedConfigState.Degraded,
    );
    await clock.advance(2 * INTERVAL);
    const view = runtime.captureView('chat-ui');
    expect(view.state).toBe(ManagedConfigState.Fresh);
    expect(view.snapshot).toBe(first);
    expect(view.staleAt).toBe(clock.now() + STALENESS);
    runtime.onModuleDestroy();
  });

  it('rejects changed content for a revision it already accepted', async () => {
    const { clock, fake, runtime } = setup();
    const sha256 = canonicalSha256('r1');
    fake.respond('chat-dev', candidate({ revisionId: 'r1', sha256 }));
    fake.respond(
      'chat-dev',
      candidate({
        revisionId: 'r1',
        sha256,
        payload: {
          config: { 'welcomeScreen.description': 'Changed' },
          features: {},
        },
      }),
    );
    await runtime.onApplicationBootstrap();
    await clock.advance(INTERVAL);

    const view = runtime.captureView('chat-ui');
    expect(view.state).toBe(ManagedConfigState.Degraded);
    expect(view.snapshot?.payload).toEqual({ config: {}, features: {} });
    runtime.onModuleDestroy();
  });

  it('keeps two instances isolated', async () => {
    const { fake, runtime } = setup({
      ...SHADOW,
      CLIENT_CONFIG_APP_IDS: ['chat-ui', 'launchpad'],
      MANAGED_CONFIG_INSTANCES: ['chat-ui=chat-dev', 'launchpad=launchpad-dev'],
    });
    fake.respond('chat-dev', revision('r1'));
    fake.respond('launchpad-dev', { kind: RuntimeReadKind.NotPublished });
    await runtime.onApplicationBootstrap();

    expect(fake.calls.sort()).toEqual(['chat-dev', 'launchpad-dev']);
    expect(runtime.captureView('chat-ui')).toMatchObject({
      instanceId: 'chat-dev',
      state: ManagedConfigState.Fresh,
    });
    const launchpad = runtime.captureView('launchpad');
    expect(launchpad).toMatchObject({
      instanceId: 'launchpad-dev',
      state: ManagedConfigState.NotPublished,
    });
    expect(launchpad.snapshot).toBeUndefined();
    runtime.onModuleDestroy();
  });

  it('rejects a snapshot of the other instance', async () => {
    const { fake, runtime } = setup({
      ...SHADOW,
      CLIENT_CONFIG_APP_IDS: ['chat-ui', 'launchpad'],
      MANAGED_CONFIG_INSTANCES: ['chat-ui=chat-dev', 'launchpad=launchpad-dev'],
    });
    fake.respond('chat-dev', revision('r1'));
    fake.respond('launchpad-dev', revision('r1'));
    await runtime.onApplicationBootstrap();

    expect(runtime.captureView('launchpad').state).toBe(
      ManagedConfigState.Unavailable,
    );
    runtime.onModuleDestroy();
  });

  it('lets separate pods converge on a new revision independently', async () => {
    /* One fake Core serves both pods; each pod has its own clock offset. */
    let published = revision('r1');
    const core = {
      read: vi.fn(async () => published),
    };
    const clockA = createFakeClock();
    const clockB = createFakeClock();
    clockB.setRandom(0.5);
    const podA = createManagedRuntime(SHADOW, core as never, clockA);
    const podB = createManagedRuntime(SHADOW, core as never, clockB);
    await podA.onApplicationBootstrap();
    await clockB.advance(20_000);
    await podB.onApplicationBootstrap();

    published = revision('r2');
    await clockA.advance(INTERVAL * 1.1);
    await clockB.advance(INTERVAL * 1.1);

    expect(podA.captureView('chat-ui').snapshot?.revisionId).toBe('r2');
    expect(podB.captureView('chat-ui').snapshot?.revisionId).toBe('r2');
    podA.onModuleDestroy();
    podB.onModuleDestroy();
  });

  it('notifies listeners of accepted and verified snapshots', async () => {
    const { clock, fake, runtime } = setup();
    const listener = vi.fn();
    runtime.onSnapshot(listener);
    const r1 = revision('r1');
    fake.respond('chat-dev', r1);
    fake.respond('chat-dev', r1);
    await runtime.onApplicationBootstrap();
    await clock.advance(INTERVAL);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0]).toMatchObject({ revisionId: 'r1' });
    runtime.onModuleDestroy();
  });

  it('never logs payload values or the reader key', async () => {
    const { clock, fake, runtime } = setup();
    const logged: string[] = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((message) => {
        logged.push(String(message));
      });
    }
    fake.respond(
      'chat-dev',
      candidate({
        payload: {
          config: { 'welcomeScreen.description': 'Secret welcome' },
          features: {},
        },
      }),
    );
    fake.respond(
      'chat-dev',
      candidate({
        payload: { config: { bad: 1 }, features: {} },
        revisionId: 'r9',
      }),
    );
    await runtime.onApplicationBootstrap();
    await clock.advance(INTERVAL);

    expect(logged.some((line) => line.includes('invalid_payload'))).toBe(true);
    expect(logged.join('\n')).not.toMatch(/Secret welcome|reader-key|"bad"/);
    runtime.onModuleDestroy();
  });

  it('exposes the body fixture it reads', () => {
    expect(snapshotBody()).toMatchObject({ instanceId: 'chat-dev' });
  });
});
