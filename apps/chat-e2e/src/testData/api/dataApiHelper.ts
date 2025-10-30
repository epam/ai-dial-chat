import { AuthTokens } from '../../core/debugAuth';
import { BaseApiHelper } from './baseApiHelper';

import { API } from '@/src/testData';
import { APIRequestContext } from '@playwright/test';

export class DataApiHelper extends BaseApiHelper {
  constructor(request: APIRequestContext) {
    super(request);
  }

  public async fetchAdditionalData(): Promise<Partial<AuthTokens>> {
    const endpoints = [
      { key: 'models', url: API.modelsHost },
      { key: 'themes', url: API.themesListingHost },
      { key: 'appSchemas', url: API.appSchemasHost },
    ];

    const data: Partial<AuthTokens> = {};

    for (const { key, url } of endpoints) {
      try {
        const response = await this.request.get(this.getHost(url));
        if (response.status() === 200) {
          data[key as keyof AuthTokens] = await response.text();
        }
      } catch (error) {
        console.warn(`Failed to get ${key} data:`, error);
      }
    }

    return data;
  }
}
