import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { API, ExpectedConstants } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { expect } from '@playwright/test';

export class ModelApiHelper extends BaseApiHelper {
  public async getModels() {
    const response = await this.request.get(this.getHost(API.modelsHost));
    const statusCode = response.status();
    expect(
      statusCode,
      `Received response code: ${statusCode} with body: ${await response.text()}`,
    ).toBe(200);
    return (await response.json()) as DialAIEntityModel[];
  }

  public async getAgentByNameAndVersion(
    agentProps: { name: string; version?: string },
    configAgents?: DialAIEntityModel[],
  ) {
    const allAgents = configAgents ?? (await this.getModels());
    return allAgents.find(
      (a) =>
        a.name === agentProps.name &&
        (agentProps.version !== undefined
          ? a.version === agentProps.version
          : a.version === ExpectedConstants.defaultEntityVersion),
    )!;
  }

  /**
   * Model that can be set as a Quick app 2.0 orchestrator.
   * @param configModels pass an already fetched models list to avoid one more request
   */
  public async getToolSupportingModel(configModels?: DialAIEntityModel[]) {
    return this.findModelByToolsSupport(true, configModels);
  }

  /**
   * Model that cannot be set as a Quick app 2.0 orchestrator.
   * @param configModels pass an already fetched models list to avoid one more request
   */
  public async getNonToolSupportingModel(configModels?: DialAIEntityModel[]) {
    return this.findModelByToolsSupport(false, configModels);
  }

  private async findModelByToolsSupport(
    supportsTools: boolean,
    configModels?: DialAIEntityModel[],
  ) {
    const allModels = configModels ?? (await this.getModels());
    return allModels.find(
      (model) =>
        model.type === EntityType.Model &&
        !!model.features?.tools === supportsTools,
    )!;
  }
}
