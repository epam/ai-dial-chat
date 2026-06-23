import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { AppConfigEvalContext } from '../../app-config.types';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';

const ctx: AppConfigEvalContext = { appId: 'chat-ui' };

function makeProvider(envOverrides: Partial<EnvironmentVariables> = {}) {
  const configService = {
    get: vi.fn(
      (key: string) => envOverrides[key as keyof EnvironmentVariables],
    ),
  } as unknown as ConfigService<EnvironmentVariables>;
  return { provider: new EnvConfigProvider(configService), configService };
}

describe('EnvConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('asr.modelId', () => {
    it('returns the ASR model ID when ASR_MODEL is set', async () => {
      const { provider } = makeProvider({ ASR_MODEL: 'whisper-1' });
      expect(await provider.resolve('asr.modelId', ctx)).toBe('whisper-1');
    });

    it('returns undefined when ASR_MODEL is not set', async () => {
      const { provider } = makeProvider({ ASR_MODEL: undefined });
      expect(await provider.resolve('asr.modelId', ctx)).toBeUndefined();
    });
  });

  describe('asr.transcribeSizeLimitBytes', () => {
    it('returns the value when TRANSCRIBE_SIZE_LIMIT_BYTES is set', async () => {
      const { provider } = makeProvider({
        TRANSCRIBE_SIZE_LIMIT_BYTES: 10_485_760,
      });
      expect(await provider.resolve('asr.transcribeSizeLimitBytes', ctx)).toBe(
        10_485_760,
      );
    });

    it('returns undefined when TRANSCRIBE_SIZE_LIMIT_BYTES is not set', async () => {
      const { provider } = makeProvider({
        TRANSCRIBE_SIZE_LIMIT_BYTES: undefined,
      });
      expect(
        await provider.resolve('asr.transcribeSizeLimitBytes', ctx),
      ).toBeUndefined();
    });
  });

  describe('features.asrEnabled', () => {
    it('returns true when ASR_MODEL is set', async () => {
      const { provider } = makeProvider({ ASR_MODEL: 'whisper-1' });
      expect(await provider.resolve('features.asrEnabled', ctx)).toBe(true);
    });

    it('returns undefined when ASR_MODEL is absent', async () => {
      const { provider } = makeProvider({ ASR_MODEL: undefined });
      expect(
        await provider.resolve('features.asrEnabled', ctx),
      ).toBeUndefined();
    });

    describe('role gating via ASR_ENABLED_ROLES', () => {
      it('returns true when ASR_ENABLED_ROLES is empty (unrestricted)', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: [],
        });
        expect(await provider.resolve('features.asrEnabled', ctx)).toBe(true);
      });

      it('returns true when user has a matching role', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: ['admin', 'ml-team'],
        });
        const ctxWithRole: AppConfigEvalContext = {
          ...ctx,
          roles: ['ml-team'],
        };
        expect(await provider.resolve('features.asrEnabled', ctxWithRole)).toBe(
          true,
        );
      });

      it('returns false when user has no roles and ASR_ENABLED_ROLES is set', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: ['admin'],
        });
        expect(await provider.resolve('features.asrEnabled', ctx)).toBe(false);
      });

      it('returns false when user roles do not intersect with ASR_ENABLED_ROLES', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: ['admin'],
        });
        const ctxWithRole: AppConfigEvalContext = {
          ...ctx,
          roles: ['viewer'],
        };
        expect(await provider.resolve('features.asrEnabled', ctxWithRole)).toBe(
          false,
        );
      });
    });
  });

  describe('unknown key', () => {
    it('returns undefined for an unknown key', async () => {
      const { provider } = makeProvider();
      expect(await provider.resolve('not.a.key', ctx)).toBeUndefined();
    });
  });

  describe('type mismatch', () => {
    it('returns undefined and logs a warning when the number value is NaN', async () => {
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'TRANSCRIBE_SIZE_LIMIT_BYTES') return NaN;
          return undefined;
        }),
      } as unknown as ConfigService<EnvironmentVariables>;
      const provider = new EnvConfigProvider(configService);
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      const result = await provider.resolve(
        'asr.transcribeSizeLimitBytes',
        ctx,
      );

      expect(result).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalled();
    });
  });
});
