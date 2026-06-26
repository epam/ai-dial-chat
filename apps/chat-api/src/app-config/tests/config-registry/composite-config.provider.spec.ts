import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigEvalContext } from '../../app-config.types';
import { CompositeConfigProvider } from '../../config-registry/composite-config.provider';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';
import { StaticDefaultsProvider } from '../../config-registry/static-defaults.provider';

const ctx: AppConfigEvalContext = { appId: 'chat-ui' };

function makeComposite(
  envResolve: (key: string) => Promise<unknown | undefined>,
  staticResolve: (key: string) => Promise<unknown | undefined>,
) {
  const envProvider = {
    resolve: vi.fn(envResolve),
  } as unknown as EnvConfigProvider;
  const staticProvider = {
    resolve: vi.fn(staticResolve),
  } as unknown as StaticDefaultsProvider;
  return {
    composite: new CompositeConfigProvider(envProvider, staticProvider),
    envProvider,
    staticProvider,
  };
}

describe('CompositeConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the first provider value when env provider resolves', async () => {
    const { composite, staticProvider } = makeComposite(
      async () => 'whisper-1',
      async () => null,
    );

    const result = await composite.resolve('asr.modelId', ctx);

    expect(result).toBe('whisper-1');
    expect(
      staticProvider.resolve as ReturnType<typeof vi.fn>,
    ).not.toHaveBeenCalled();
  });

  it('falls through to static defaults when env provider returns undefined', async () => {
    const { composite } = makeComposite(
      async () => undefined,
      async () => 5_242_880,
    );

    const result = await composite.resolve('asr.transcribeSizeLimitBytes', ctx);

    expect(result).toBe(5_242_880);
  });

  it('swallows provider errors and falls through to next provider', async () => {
    const { composite } = makeComposite(
      async () => {
        throw new Error('provider failure');
      },
      async () => false,
    );

    const result = await composite.resolve('features.asrEnabled', ctx);

    expect(result).toBe(false);
  });

  it('logs at error level when a critical key provider throws', async () => {
    const envProvider = {
      resolve: vi.fn(async () => {
        throw new Error('critical failure');
      }),
    } as unknown as EnvConfigProvider;
    const staticProvider = {
      resolve: vi.fn(async () => false),
    } as unknown as StaticDefaultsProvider;
    const composite = new CompositeConfigProvider(envProvider, staticProvider);

    const loggerErrorSpy = vi.spyOn(composite['logger'], 'error');
    const loggerWarnSpy = vi.spyOn(composite['logger'], 'warn');

    // 'features.asrEnabled' has critical=false — verify warn is used for non-critical
    await composite.resolve('features.asrEnabled', ctx);
    expect(loggerWarnSpy).toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('returns undefined when all providers return undefined', async () => {
    const { composite } = makeComposite(
      async () => undefined,
      async () => undefined,
    );

    const result = await composite.resolve('asr.modelId', ctx);

    expect(result).toBeUndefined();
  });
});
