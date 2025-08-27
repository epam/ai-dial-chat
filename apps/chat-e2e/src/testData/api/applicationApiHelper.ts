import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { BackendEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class ApplicationApiHelper extends BaseApiHelper {
  public async createApplication(appModel: ApiApplicationModelRegular) {
    const url = `${API.applicationCreateHost}/${this.userBucket ?? BucketUtil.getBucket()}/${appModel.display_name}${ItemUtil.entityIdSeparator}${appModel.display_version}`;
    const response = await this.request.post(
      this.getHost(ItemUtil.getEncodedItemId(url)),
      {
        data: appModel,
      },
    );
    expect(
      response.status(),
      `Application created with data: ${JSON.stringify(appModel)}`,
    ).toBe(200);
    return (await response.json()) as BackendEntity;
  }
}
