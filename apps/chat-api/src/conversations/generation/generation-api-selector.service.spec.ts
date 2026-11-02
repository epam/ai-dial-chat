import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import type { DeploymentsService } from '../../deployments/deployments.service';
import { DeploymentItemType } from '../../deployments/dto/deployment-item.dto';
import { GenerationApi } from './generation-api';
import { GenerationApiSelector } from './generation-api-selector.service';

describe('GenerationApiSelector', () => {
  let getDeploymentDetails: ReturnType<typeof vi.fn>;
  let getDeploymentInterfaces: ReturnType<typeof vi.fn>;
  let isEnabled: ReturnType<typeof vi.fn>;
  let selector: GenerationApiSelector;

  const givenFlags = (flags: Partial<Record<FeatureKey, boolean>>) => {
    isEnabled.mockImplementation(
      async (key: FeatureKey) => flags[key] ?? false,
    );
  };

  const givenModelFeatures = (features: Record<string, unknown>) => {
    getDeploymentDetails.mockResolvedValue({
      id: 'gpt-4o',
      type: DeploymentItemType.Model,
      modelDetails: { features },
    });
  };

  const select = () => selector.select('sub', 'gpt-4o', 'token');

  beforeEach(() => {
    getDeploymentDetails = vi.fn();
    getDeploymentInterfaces = vi.fn().mockResolvedValue([]);
    isEnabled = vi.fn();
    selector = new GenerationApiSelector(
      {
        getDeploymentDetails,
        getDeploymentInterfaces,
      } as unknown as DeploymentsService,
      { isEnabled } as unknown as FeatureFlagsService,
    );
  });

  it('rejects a toolset with BadRequestException whatever the flags are', async () => {
    givenFlags({
      [FeatureKey.ResponsesApiEnabled]: true,
      [FeatureKey.ResponsesBackgroundEnabled]: true,
    });
    getDeploymentDetails.mockResolvedValue({ id: 'tools', type: 'toolset' });

    await expect(select()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forces Chat Completions when the Responses flag is off and still reads the deployment details', async () => {
    givenFlags({});
    givenModelFeatures({ responsesApi: true });

    const selection = await select();

    expect(selection.generationApi).toBe(GenerationApi.ChatCompletions);
    expect(getDeploymentDetails).toHaveBeenCalledOnce();
  });

  it('selects Responses when the flag is on and the deployment supports it', async () => {
    givenFlags({ [FeatureKey.ResponsesApiEnabled]: true });
    givenModelFeatures({ responsesApi: true });

    await expect(select()).resolves.toMatchObject({
      generationApi: GenerationApi.Responses,
      isBackground: false,
    });
    expect(getDeploymentInterfaces).not.toHaveBeenCalled();
  });

  it('selects background mode only with both flags and the openaiResponses interface', async () => {
    givenFlags({
      [FeatureKey.ResponsesApiEnabled]: true,
      [FeatureKey.ResponsesBackgroundEnabled]: true,
    });
    givenModelFeatures({ responsesApi: true });

    getDeploymentInterfaces.mockResolvedValue(['openaiResponses']);
    await expect(select()).resolves.toMatchObject({ isBackground: true });

    getDeploymentInterfaces.mockResolvedValue(['chatCompletion']);
    await expect(select()).resolves.toMatchObject({ isBackground: false });
  });

  it('falls back to the stateless path when the interfaces lookup fails', async () => {
    givenFlags({
      [FeatureKey.ResponsesApiEnabled]: true,
      [FeatureKey.ResponsesBackgroundEnabled]: true,
    });
    givenModelFeatures({ responsesApi: true });
    getDeploymentInterfaces.mockRejectedValue(new Error('Core down'));

    await expect(select()).resolves.toMatchObject({
      generationApi: GenerationApi.Responses,
      isBackground: false,
    });
  });

  it('reads temperatureSupported and reasoningEfforts from the same features', async () => {
    givenFlags({});
    givenModelFeatures({
      temperature: true,
      reasoningEfforts: ['low', 'high'],
    });

    await expect(select()).resolves.toEqual({
      generationApi: GenerationApi.ChatCompletions,
      isBackground: false,
      temperatureSupported: true,
      reasoningEfforts: ['low', 'high'],
    });
  });
});
