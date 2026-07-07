import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../app-config.service';
import type { AppConfigEvalContext } from '../../app-config.types';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { FeatureKey } from '../../feature-flags/feature-key.enum';

const ctx: AppConfigEvalContext = { appId: 'chat-ui' };

function makeService(isEnabledImpl: (key: FeatureKey) => Promise<boolean>) {
  const appConfigService = {
    isEnabled: vi.fn(isEnabledImpl),
  } as unknown as AppConfigService;
  return new FeatureFlagsService(appConfigService);
}

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the feature is enabled', async () => {
    const service = makeService(async () => true);
    expect(await service.isEnabled(FeatureKey.AsrEnabled, ctx)).toBe(true);
  });

  it('returns false when the feature is disabled', async () => {
    const service = makeService(async () => false);
    expect(await service.isEnabled(FeatureKey.AsrEnabled, ctx)).toBe(false);
  });

  it('resolves LlmConversationNaming through AppConfigService', async () => {
    const service = makeService(
      async (key) => key === FeatureKey.LlmConversationNaming,
    );
    expect(await service.isEnabled(FeatureKey.LlmConversationNaming, ctx)).toBe(
      true,
    );
  });

  it('rejects non-feature keys with BadRequestException', async () => {
    const service = makeService(async () => false);
    await expect(
      service.isEnabled('asr.modelId' as FeatureKey, ctx),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns false on AppConfigService error (fail closed)', async () => {
    const appConfigService = {
      isEnabled: vi.fn(async () => {
        throw new Error('unexpected provider error');
      }),
    } as unknown as AppConfigService;
    const service = new FeatureFlagsService(appConfigService);

    expect(await service.isEnabled(FeatureKey.AsrEnabled, ctx)).toBe(false);
  });
});
