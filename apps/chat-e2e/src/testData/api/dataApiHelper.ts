import { AuthTokens } from '../../core/debugAuth';

import { API } from '@/src/testData';
import { APIRequestContext } from '@playwright/test';

export class DataApiHelper {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {}

  public async fetchAdditionalData(): Promise<Partial<AuthTokens>> {
    const endpoints = [
      { key: 'models', url: API.modelsHost },
      { key: 'addons', url: API.addonsHost },
      { key: 'themes', url: API.themesListingHost },
    ];

    const data: Partial<AuthTokens> = {};

    for (const { key, url } of endpoints) {
      try {
        const response = await this.request.get(`${this.baseUrl}${url}`);
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
