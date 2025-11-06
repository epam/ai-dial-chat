import { BaseApiHelper } from './baseApiHelper';

import { API } from '@/src/testData';
import { APIRequestContext } from '@playwright/test';

export class BucketApiHelper extends BaseApiHelper {
  constructor(request: APIRequestContext) {
    super(request);
  }

  public async getBucket(): Promise<{ bucket: string; bucketJson: string }> {
    const response = await this.request.get(this.getHost(API.bucketHost));
    if (response.status() !== 200) {
      throw new Error(`Failed to get bucket: ${response.status()}`);
    }

    const bucketJson = await response.text();
    const { bucket } = JSON.parse(bucketJson) as { bucket: string };

    return { bucket, bucketJson };
  }
}
