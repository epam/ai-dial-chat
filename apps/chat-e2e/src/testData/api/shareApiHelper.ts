import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity, BackendResourceType } from '@/chat/types/common';
import {
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
  ShareListingRequestModel,
  ShareRelations,
  ShareRequestModel,
  ShareRequestType,
} from '@/chat/types/share';
import { API, ExpectedConstants } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { expect } from '@playwright/test';

export class ShareApiHelper extends BaseApiHelper {
  public async shareEntityByLink(entity: Conversation, isFolder = false) {
    const requestData: ShareRequestModel = {
      invitationType: ShareRequestType.link,
      resources: [{ url: isFolder ? `${entity.folderId!}/` : entity.id! }],
    };
    const response = await this.request.post(API.shareConversationHost, {
      data: requestData,
    });
    expect(
      response.status(),
      `Successfully created share invitation link`,
    ).toBe(200);
    const responseText = await response.text();
    return JSON.parse(responseText) as ShareByLinkResponseModel;
  }

  public async acceptInvite(
    shareLinkResponse: ShareByLinkResponseModel,
    expectedHttpCode = 200,
  ) {
    const requestData: ShareAcceptRequestModel = {
      invitationId: ExpectedConstants.sharedLink(
        shareLinkResponse.invitationLink,
      ),
    };
    const response = await this.request.post(API.shareInviteAcceptanceHost, {
      data: requestData,
    });
    expect(
      response.status(),
      `Successfully accepted share invitation link`,
    ).toBe(expectedHttpCode);
  }

  public async listSharedWithMeConversations() {
    const requestData: ShareListingRequestModel = {
      resourceTypes: [BackendResourceType.CONVERSATION],
      with: ShareRelations.me,
      order: 'popular_asc',
    };
    const response = await this.request.post(API.shareWithMeListing, {
      data: requestData,
    });
    const entities = (await response.json()) as {
      resources: BackendChatEntity[];
    };
    expect(
      response.status(),
      `Received shared items: ${JSON.stringify(entities)}`,
    ).toBe(200);
    return entities;
  }
}
