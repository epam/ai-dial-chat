import {
  Publication,
  PublicationInfo,
  PublicationRequestModel,
  PublicationStatus,
  PublicationsListModel,
} from '@/chat/types/publication';
import { API, ExpectedConstants } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { GeneratorUtil, ItemUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

export type PublicationProps = PublicationInfo & Partial<Publication>;

export class PublicationApiHelper extends BaseApiHelper {
  public async listPublicationRequests() {
    const response = await this.request.post(API.pendingPublicationsListing, {
      data: { url: `publications/${ExpectedConstants.rootPublicationFolder}` },
    });
    const statusCode = response.status();
    expect(
      statusCode,
      `Received response code: ${statusCode} with body: ${await response.text()}`,
    ).toBe(200);
    return (await response.json()) as PublicationsListModel;
  }

  public async getPublicationRequestDetails(publicationUrl: string) {
    const response = await this.request.post(API.publicationRequestDetails, {
      data: { url: publicationUrl },
    });
    const statusCode = response.status();
    expect(
      statusCode,
      `Received response code: ${statusCode} with body: ${await response.text()}`,
    ).toBe(200);
    return (await response.json()) as Publication;
  }

  public async approveRequest(
    publicationRequest: Publication | PublicationInfo,
  ) {
    const response = await this.request.post(API.publicationRequestApproval, {
      data: { url: publicationRequest.url },
    });
    expect(response.status(), `Successfully approved publication request`).toBe(
      200,
    );
  }

  public async rejectRequest(
    publicationRequest: Publication | PublicationInfo,
  ) {
    const response = await this.request.post(API.publicationRequestRejection, {
      data: { url: publicationRequest.url },
    });
    expect(response.status(), `Successfully rejected publication request`).toBe(
      200,
    );
  }

  public async createPublishRequest(requestModel: PublicationRequestModel) {
    for (const resource of requestModel.resources) {
      resource.targetUrl = ItemUtil.getEncodedItemId(resource.targetUrl);
      if (resource.sourceUrl) {
        resource.sourceUrl = ItemUtil.getEncodedItemId(resource.sourceUrl);
      }
    }
    requestModel.targetFolder = ItemUtil.getEncodedItemId(
      requestModel.targetFolder,
    );

    const response = await this.request.post(API.publicationRequestCreate, {
      data: requestModel,
    });
    expect(response.status(), `Successfully created publication request`).toBe(
      200,
    );
    const responseText = await response.text();
    return JSON.parse(responseText) as Publication;
  }

  public async createUnpublishRequest(
    publicationRequest: Publication | PublicationRequestModel,
  ) {
    const unpublishResources = [];
    for (const resource of publicationRequest.resources) {
      unpublishResources.push({
        action: PublishActions.DELETE,
        targetUrl: resource.targetUrl,
      });
    }
    const data: PublicationRequestModel = {
      name: GeneratorUtil.randomUnpublishRequestName(),
      targetFolder: publicationRequest.targetFolder,
      resources: unpublishResources,
      rules: publicationRequest.rules,
    };
    const response = await this.request.post(API.publicationRequestCreate, {
      data: data,
    });
    expect(response.status(), `Successfully created unpublish request`).toBe(
      200,
    );
    const responseText = await response.text();
    const responseJson = JSON.parse(responseText) as PublicationProps;
    expect(responseJson.url).toBeDefined();
    expect(responseJson.status).toBe(PublicationStatus.PENDING);
    return responseJson;
  }
}
