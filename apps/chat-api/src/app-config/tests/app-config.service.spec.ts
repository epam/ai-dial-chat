import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../app-config.service';
import type { AppConfigEvalContext } from '../app-config.types';
import type { CompositeConfigProvider } from '../config-registry/composite-config.provider';
import { FeatureKey } from '../feature-flags/feature-key.enum';

const ctx: AppConfigEvalContext = { appId: 'chat-ui' };

function makeService(
  resolveImpl: (key: string) => Promise<unknown | undefined>,
) {
  const compositeProvider = {
    resolve: vi.fn(resolveImpl),
  } as unknown as CompositeConfigProvider;
  const cacheStore = new Map<string, unknown>();
  const cacheManager = {
    get: vi.fn(async (key: string) => cacheStore.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    }),
  };
  return {
    service: new AppConfigService(compositeProvider, cacheManager as never),
    cacheManager,
    compositeProvider,
  };
}

describe('AppConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClientConfig', () => {
    it('filters server-only keys and only returns client-visible config', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      // No server-only keys should appear in features or config
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('roles');
      expect(result).not.toHaveProperty('environment');
      expect(result.appId).toBe('chat-ui');
      expect(typeof result.features).toBe('object');
      expect(typeof result.config).toBe('object');
    });

    it('returns safe defaults when all providers return undefined', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      expect(result.features['asrEnabled']).toBe(false);
      expect(result.config.asrModelId).toBeNull();
      expect(result.config.transcribeSizeLimitBytes).toBe(5 * 1024 * 1024);
    });

    it('returns resolved values when providers succeed', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'asr.modelId') return 'whisper-1';
        if (key === 'features.asrEnabled') return true;
        if (key === 'asr.transcribeSizeLimitBytes') return 10_485_760;
        return undefined;
      });
      const result = await service.getClientConfig(ctx);

      expect(result.features['asrEnabled']).toBe(true);
      expect(result.config.asrModelId).toBe('whisper-1');
      expect(result.config.transcribeSizeLimitBytes).toBe(10_485_760);
    });

    it('includes metadata with resolvedAt and cacheTtlSeconds', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata?.resolvedAt).toBe('string');
      expect(result.metadata?.cacheTtlSeconds).toBe(60);
    });

    it('caches resolved config for the same user and roles', async () => {
      const { service, cacheManager, compositeProvider } = makeService(
        async () => undefined,
      );

      const first = await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['viewer', 'admin'],
      });
      const second = await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['admin', 'viewer'],
      });

      expect(second).toEqual(first);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'app-config:client:chat-ui:user:user-1:roles:admin,viewer',
        first,
        60_000,
      );
      expect(compositeProvider.resolve).toHaveBeenCalledTimes(3);
    });

    it('does not share cached config across role sets', async () => {
      const { service, compositeProvider } = makeService(async () => undefined);

      await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['admin'],
      });
      await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['viewer'],
      });

      expect(compositeProvider.resolve).toHaveBeenCalledTimes(6);
    });
  });

  describe('isEnabled', () => {
    it('returns false when provider returns undefined (fail closed)', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.isEnabled(FeatureKey.AsrEnabled, ctx);
      expect(result).toBe(false);
    });

    it('returns true when feature is enabled', async () => {
      const { service } = makeService(async () => true);
      const result = await service.isEnabled(FeatureKey.AsrEnabled, ctx);
      expect(result).toBe(true);
    });

    it('returns false when provider throws (fail closed)', async () => {
      const { service } = makeService(async () => {
        throw new Error('provider failure');
      });
      const result = await service.isEnabled(FeatureKey.AsrEnabled, ctx);
      expect(result).toBe(false);
    });

    it('throws BadRequestException for a config-type key', async () => {
      const { service } = makeService(async () => undefined);
      await expect(
        service.isEnabled('asr.modelId' as FeatureKey, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveValue', () => {
    it('delegates to CompositeConfigProvider', async () => {
      const compositeProvider = {
        resolve: vi.fn(async () => 'test-value'),
      } as unknown as CompositeConfigProvider;
      const service = new AppConfigService(compositeProvider, {
        get: vi.fn(),
        set: vi.fn(),
      } as never);

      const result = await service.resolveValue('asr.modelId', ctx);

      expect(result).toBe('test-value');
      expect(compositeProvider.resolve).toHaveBeenCalledWith(
        'asr.modelId',
        ctx,
      );
    });
  });
});
