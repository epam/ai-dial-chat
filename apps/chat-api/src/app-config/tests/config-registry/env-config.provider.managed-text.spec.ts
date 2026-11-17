import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import type { AppConfigEvalContext } from '../../app-config.types';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';

/* Schema 1.0.0 manages no text key, so the blank-text rule runs on the
 * test-only contract, which manages welcomeScreen.description (see
 * test-managed-contract.fixtures.ts). */
vi.mock(
  '../../config-registry/config-registry.constants',
  async (importOriginal) =>
    (
      await import('../managed-config/test-managed-contract.fixtures')
    ).withTestManagedRegistry(await importOriginal()),
);

const ctx: AppConfigEvalContext = { appId: 'ai-dial-chat' };

const providerWith = (values: Partial<EnvironmentVariables>) =>
  new EnvConfigProvider(
    {
      get: (key: string) => values[key as keyof EnvironmentVariables],
    } as unknown as ConfigService<EnvironmentVariables>,
    ExplicitEnvironment.of(Object.keys(values)),
  );

describe('EnvConfigProvider with a managed text key', () => {
  it.each(['', '   '])(
    'does not treat a blank managed text %j as an operator value',
    async (blank) => {
      const provider = providerWith({ WELCOME_SCREEN_DESCRIPTION: blank });
      expect(
        await provider.resolve('welcomeScreen.description', ctx),
      ).toBeUndefined();
    },
  );

  it('keeps a blank unmanaged text', async () => {
    const provider = providerWith({ ANNOUNCEMENT_TITLE: '' });
    expect(await provider.resolve('announcement.title', ctx)).toBe('');
  });

  it('keeps a non-blank managed text', async () => {
    const provider = providerWith({ WELCOME_SCREEN_DESCRIPTION: ' Hi ' });
    expect(await provider.resolve('welcomeScreen.description', ctx)).toBe(
      ' Hi ',
    );
  });
});
