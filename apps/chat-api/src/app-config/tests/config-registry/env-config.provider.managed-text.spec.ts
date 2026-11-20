import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import type { AppConfigEvalContext } from '../../app-config.types';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';

/* Schema 1.1.0 manages the two banner texts; welcomeScreen.description
 * stays unmanaged until 1.2.0. */
const ctx: AppConfigEvalContext = { appId: 'ai-dial-chat' };

const providerWith = (values: Partial<EnvironmentVariables>) =>
  new EnvConfigProvider(
    {
      get: (key: string) => values[key as keyof EnvironmentVariables],
    } as unknown as ConfigService<EnvironmentVariables>,
    ExplicitEnvironment.of(Object.keys(values)),
  );

describe('EnvConfigProvider with a managed text key', () => {
  it.each([
    ['announcement.title', 'ANNOUNCEMENT_TITLE', ''],
    ['announcement.title', 'ANNOUNCEMENT_TITLE', '   '],
    ['announcement.description', 'ANNOUNCEMENT_DESCRIPTION', ''],
    ['announcement.description', 'ANNOUNCEMENT_DESCRIPTION', '   '],
  ])(
    'does not treat a blank %s (%s=%j) as an operator value',
    async (key, envVar, blank) => {
      const provider = providerWith({ [envVar]: blank });
      expect(await provider.resolve(key, ctx)).toBeUndefined();
    },
  );

  it('keeps a blank unmanaged text', async () => {
    const provider = providerWith({ WELCOME_SCREEN_DESCRIPTION: '   ' });
    expect(await provider.resolve('welcomeScreen.description', ctx)).toBe(
      '   ',
    );
  });

  it('keeps a non-blank managed text', async () => {
    const provider = providerWith({ ANNOUNCEMENT_TITLE: ' Hi ' });
    expect(await provider.resolve('announcement.title', ctx)).toBe(' Hi ');
  });

  it('lets typed delivery defaults fall through to a published policy', async () => {
    const provider = providerWith({});
    for (const key of [
      'ui.celebrationDelivery.mode',
      'ui.celebrationDelivery.revision',
      'ui.celebrationDelivery.externalScenes',
      'ui.celebrationDelivery.externalEvents',
      'ui.celebrationsEnabledByDefault',
    ]) {
      expect(await provider.resolve(key, ctx), key).toBeUndefined();
    }
  });
});
