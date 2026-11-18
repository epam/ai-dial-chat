import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalSha256 } from '../../managed-config/canonical-json';
import { describeManagedSettings } from '../../managed-runtime/managed-runtime.service';
import { ManagedConfigMode } from '../../managed-runtime/managed-runtime.types';
import {
  candidate,
  createFakeClock,
  createFakeReader,
  createManagedRuntime,
  MANAGED_ENVIRONMENT,
} from './managed-runtime.fixtures';

/* add-managed-config-debug-logs: the startup line and the per-read debug line. */
const ACTIVE = {
  ...MANAGED_ENVIRONMENT,
  MANAGED_CONFIG_MODE: ManagedConfigMode.Active,
  MANAGED_CONFIG_ACTIVE_KEYS: ['onboarding.hints'],
};
const SECRET_VALUE = 'Secret hint title';

const messages = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((call) => String(call[0]));

describe('managed configuration debug logs', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('logs that nothing is read in off mode', () => {
    createManagedRuntime({});
    expect(messages(log)).toContain(
      'Managed configuration: mode off; no Config Studio snapshot is read',
    );
  });

  it('logs the settings at startup without the reader key', () => {
    const runtime = createManagedRuntime(ACTIVE);
    expect(messages(log)).toContain(
      'Managed configuration: mode active, instances ai-dial-chat=chat-dev, active keys onboarding.hints, refresh 60s, max staleness 900s, reader key set',
    );
    expect(
      describeManagedSettings({ ...runtime.settings, apiKey: '' }),
    ).toContain('reader key missing');
    expect(messages(log).join('\n')).not.toContain('reader-key');
  });

  it('logs each read at debug level without the payload', async () => {
    const clock = createFakeClock();
    const fake = createFakeReader();
    const payload = {
      config: {
        'onboarding.hints': [
          { id: 'one', target: 'new-chat', title: SECRET_VALUE },
        ],
      },
      features: {},
    };
    fake.respond(
      'chat-dev',
      candidate({
        revisionId: 'r1',
        sha256: canonicalSha256({ revisionId: 'r1', payload }),
        payload,
      }),
    );
    const runtime = createManagedRuntime(ACTIVE, fake.reader, clock);
    await runtime.onApplicationBootstrap();
    runtime.onModuleDestroy();
    const reads = messages(debug).filter((line) =>
      line.startsWith('Managed read of instance chat-dev'),
    );
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatch(
      /^Managed read of instance chat-dev: candidate, outcome accepted, revision r1, \d+ ms$/,
    );
    expect(reads[0]).not.toContain(SECRET_VALUE);
  });
});
