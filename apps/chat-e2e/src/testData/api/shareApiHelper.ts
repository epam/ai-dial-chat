import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity, BackendResourceType } from '@/chat/types/common';
import {
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
  ShareListingRequestModel,
  ShareRelations,
  ShareRequestModel,
  ShareRequestType,
  ShareRevokeRequestModel,
} from '@/chat/types/share';
import { API, ExpectedConstants } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { expect } from '@playwright/test';

export class ShareApiHelper extends BaseApiHelper {
  public async shareEntityByLink(
    entities: Conversation[],
    isFolder = false,
    folderToShare?: string,
  ) {
    const resources: { url: string }[] = [];
    for (const entity of entities) {
      let url: string;

      if (isFolder) {
        if (folderToShare !== undefined) {
          const folderIndex = entity.folderId.indexOf(folderToShare);
          url = `${entity.folderId.substring(0, folderIndex + folderToShare.length)}/`;
        } else {
          url = `${entity.folderId!}/`;
        }
      } else {
        url = entity.id!;
      }
      if (!resources.find((r) => r.url === url)) {
        resources.push({ url: url });
      }
      entity.messages.map((m) =>
        m.custom_content?.attachments?.forEach((a) =>
          resources.push({ url: a.url! }),
        ),
      );
    }

    const requestData: ShareRequestModel = {
      invitationType: ShareRequestType.link,
      resources: resources,
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

  public async listSharedWithMeEntities() {
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

  public async deleteSharedWithMeEntities(entities: BackendChatEntity[]) {
    if (entities.length > 0) {
      const entityUrls: { url: string }[] = [];
      entities.forEach((e) => {
        entityUrls.push({ url: e.url });
      });
      const requestData: ShareRevokeRequestModel = {
        resources: entityUrls,
      };
      const response = await this.request.post(API.discardShareWithMeItem, {
        data: requestData,
      });
      expect(response.status(), `Shared items successfully deleted`).toBe(200);
    }
  }
}
