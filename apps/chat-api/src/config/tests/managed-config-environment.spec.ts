import { describe, expect, it, vi } from 'vitest';
import { ManagedConfigMode } from '../../app-config/managed-runtime/managed-runtime.types';
import { validate } from '../validation';

const BASE = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

const MANAGED = {
  ...BASE,
  MANAGED_CONFIG_MODE: 'shadow',
  MANAGED_CONFIG_INSTANCES: 'ai-dial-chat=chat-dev',
  MANAGED_CONFIG_API_KEY: 'super-secret-reader-key',
  MANAGED_CONFIG_MAX_STALENESS_SECONDS: '900',
};

/* Every failure is reported without printing the reader key. */
const expectFailure = (config: Record<string, unknown>, message: string) => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  let thrown: unknown;
  try {
    validate(config);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  const text = (thrown as Error).message;
  expect(text).toContain('Environment validation failed:');
  expect(text).toContain(message);
  expect(text).not.toContain('super-secret-reader-key');
};

describe('managed configuration environment', () => {
  it('reads nothing and requires nothing by default', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const config = validate(BASE);
    expect(config.MANAGED_CONFIG_MODE).toBe(ManagedConfigMode.Off);
    expect(config.MANAGED_CONFIG_INSTANCES).toEqual([]);
    expect(config.MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS).toBe(60);
    expect(config.MANAGED_CONFIG_CLIENT_REFRESH_SECONDS).toBe(120);
    expect(config.MANAGED_CONFIG_MAX_STALENESS_SECONDS).toBeUndefined();
  });

  it('accepts a complete shadow configuration and trims the pairs', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const config = validate({
      ...MANAGED,
      CLIENT_CONFIG_APP_IDS: 'ai-dial-chat,launchpad',
      MANAGED_CONFIG_INSTANCES:
        ' ai-dial-chat = chat-dev , launchpad=launchpad-dev',
    });
    expect(config.MANAGED_CONFIG_INSTANCES).toEqual([
      'ai-dial-chat=chat-dev',
      'launchpad=launchpad-dev',
    ]);
  });

  it('rejects an unknown mode', () => {
    expectFailure(
      { ...BASE, MANAGED_CONFIG_MODE: 'on' },
      'MANAGED_CONFIG_MODE must be one of: off, shadow, active',
    );
  });

  it('requires the maximum staleness outside off mode', () => {
    const {
      MANAGED_CONFIG_MAX_STALENESS_SECONDS: _omitted,
      ...withoutStaleness
    } = MANAGED;
    expectFailure(
      withoutStaleness,
      'MANAGED_CONFIG_MAX_STALENESS_SECONDS is required',
    );
  });

  it('requires at least three refresh intervals of staleness', () => {
    expectFailure(
      { ...MANAGED, MANAGED_CONFIG_MAX_STALENESS_SECONDS: '120' },
      'MANAGED_CONFIG_MAX_STALENESS_SECONDS must be at least 3 times MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS',
    );
  });

  it('requires the reader key outside off mode', () => {
    expectFailure(
      { ...MANAGED, MANAGED_CONFIG_API_KEY: '   ' },
      'MANAGED_CONFIG_API_KEY is required',
    );
  });

  it('requires a mapping outside off mode', () => {
    expectFailure(
      { ...MANAGED, MANAGED_CONFIG_INSTANCES: '' },
      'MANAGED_CONFIG_INSTANCES is required',
    );
  });

  it('rejects a mapping for an identifier the deployment does not serve', () => {
    expectFailure(
      {
        ...MANAGED,
        CLIENT_CONFIG_APP_IDS: 'ai-dial-chat',
        MANAGED_CONFIG_INSTANCES:
          'ai-dial-chat=chat-dev,launchpad=launchpad-dev',
      },
      'MANAGED_CONFIG_INSTANCES may only map application identifiers listed in CLIENT_CONFIG_APP_IDS',
    );
  });

  it.each([
    [
      'an identifier twice',
      'ai-dial-chat=chat-dev,ai-dial-chat=chat-prod',
      'maps an application identifier twice',
    ],
    [
      'an instance twice',
      'ai-dial-chat=chat-dev,launchpad=chat-dev',
      'maps an instance twice',
    ],
  ])('rejects a mapping with %s', (_label, instances, message) => {
    expectFailure(
      {
        ...MANAGED,
        CLIENT_CONFIG_APP_IDS: 'ai-dial-chat,launchpad',
        MANAGED_CONFIG_INSTANCES: instances,
      },
      message,
    );
  });

  it('maps the legacy chat-ui identifier to ai-dial-chat', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const config = validate({
      ...MANAGED,
      CLIENT_CONFIG_APP_IDS: 'chat-ui,launchpad',
      MANAGED_CONFIG_INSTANCES:
        'chat-ui = ai-dial-chat,launchpad=launchpad-dev',
    });
    expect(config.CLIENT_CONFIG_APP_IDS).toEqual(['ai-dial-chat', 'launchpad']);
    expect(config.MANAGED_CONFIG_INSTANCES).toEqual([
      'ai-dial-chat=ai-dial-chat',
      'launchpad=launchpad-dev',
    ]);
  });

  it('rejects mapping both the legacy and the current identifier', () => {
    expectFailure(
      {
        ...MANAGED,
        MANAGED_CONFIG_INSTANCES: 'chat-ui=chat-dev,ai-dial-chat=chat-prod',
      },
      'maps an application identifier twice',
    );
  });

  it('rejects a malformed pair', () => {
    expectFailure(
      { ...MANAGED, MANAGED_CONFIG_INSTANCES: 'Chat_UI=chat-dev' },
      'Each MANAGED_CONFIG_INSTANCES entry must be appId=instanceId',
    );
  });

  it('accepts and ignores active keys outside active mode, so the mode alone rolls back', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    for (const mode of ['off', 'shadow']) {
      expect(() =>
        validate({
          ...MANAGED,
          MANAGED_CONFIG_MODE: mode,
          MANAGED_CONFIG_ACTIVE_KEYS: 'footer.html',
        }),
      ).not.toThrow();
    }
  });

  it('rejects a local-only key in the active list', () => {
    expectFailure(
      {
        ...MANAGED,
        MANAGED_CONFIG_MODE: 'active',
        MANAGED_CONFIG_ACTIVE_KEYS: 'footer.html',
      },
      'MANAGED_CONFIG_ACTIVE_KEYS lists "footer.html", which is not a managed key',
    );
  });

  it('accepts managed keys in the active list', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const config = validate({
      ...MANAGED,
      MANAGED_CONFIG_MODE: 'active',
      MANAGED_CONFIG_ACTIVE_KEYS: ' onboarding.hints ',
    });
    expect(config.MANAGED_CONFIG_ACTIVE_KEYS).toEqual(['onboarding.hints']);
  });

  /* Schema 1.0.0 manages only the onboarding tour; these keys were managed
   * before it and return in schema 1.1.0. */
  it.each([
    'welcomeScreen.description',
    'usageLimits.spendingLimitsMode',
    'features.usageLimitsControl',
  ])('rejects the eligible but unmanaged key %s in the active list', (key) => {
    expectFailure(
      {
        ...MANAGED,
        MANAGED_CONFIG_MODE: 'active',
        MANAGED_CONFIG_ACTIVE_KEYS: `onboarding.hints,${key}`,
      },
      `MANAGED_CONFIG_ACTIVE_KEYS lists "${key}", which is not a managed key`,
    );
  });
});
