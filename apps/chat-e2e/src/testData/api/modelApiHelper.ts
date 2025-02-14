import { DialAIEntityModel } from '@/chat/types/models';
import { API } from '@/src/testData';
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
}
