import { OpenAIEntityModel } from '@/src/types/openai';

import { API } from '@/e2e/src/testData';
import { APIRequestContext } from '@playwright/test';

export class ApiHelper {
  private request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  public async getDefaultEntityIcon() {
    const response = await this.request.get(API.defaultIconHost);
    return this.formatIconResponse(response.text());
  }

  public async getEntityIcon(entity: OpenAIEntityModel) {
    let icon;
    if (entity.iconUrl) {
      const response = await this.request.get(entity.iconUrl);
      icon = await this.formatIconResponse(response.text());
    } else {
      icon = await this.getDefaultEntityIcon();
    }
    return icon;
  }

  private async formatIconResponse(responseText: Promise<string>) {
    return responseText.then((resp) =>
      resp
        .replaceAll('\n', '')
        .replaceAll(/.*<svg[^>]*>/g, '')
        .replaceAll(/<\/svg>/g, '')
        .replaceAll(/\s{2,}/g, '')
        .replaceAll(/\/>$/g, '></path>'),
    );
  }
}
