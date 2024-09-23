import {
  Publication,
  PublicationRequestModel,
  PublishActions,
} from '@/chat/types/publication';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class PublicationApiHelper extends BaseApiHelper {
  public async approveRequest(publicationRequest: Publication) {
    const response = await this.request.post(API.publicationRequestApproval, {
      data: { url: publicationRequest.url },
    });
    expect(response.status(), `Successfully approved publication request`).toBe(
      200,
    );
  }

  public async rejectRequest(publicationRequest: Publication) {
    const response = await this.request.post(API.publicationRequestRejection, {
      data: { url: publicationRequest.url },
    });
    expect(response.status(), `Successfully rejected publication request`).toBe(
      200,
    );
  }

  public async createPublishRequest(requestModel: PublicationRequestModel) {
    const response = await this.request.post(API.publicationRequestCreate, {
      data: requestModel,
    });
    expect(response.status(), `Successfully created publication request`).toBe(
      200,
    );
    const responseText = await response.text();
    return JSON.parse(responseText) as Publication;
  }

  public async createUnpublishRequest(publicationRequest: Publication) {
    const resources = [
      {
        action: PublishActions.DELETE,
        targetUrl: publicationRequest.resources[0].targetUrl,
      },
    ];
    const data: PublicationRequestModel = {
      name: GeneratorUtil.randomUnpublishRequestName(),
      targetFolder: publicationRequest.targetFolder,
      resources: resources,
      rules: publicationRequest.rules,
    };
    const response = await this.request.post(API.publicationRequestCreate, {
      data: data,
    });
    expect(response.status(), `Successfully created unpublish request`).toBe(
      200,
    );
    const responseText = await response.text();
    return JSON.parse(responseText) as Publication;
  }

  public async unpublishPublication(publicationRequest: Publication) {
    const unpublishResponse =
      await this.createUnpublishRequest(publicationRequest);
    await this.approveRequest(unpublishResponse);
  }
}
