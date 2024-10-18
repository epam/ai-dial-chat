import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity, BackendResourceType } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
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
import { ItemUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class ShareApiHelper extends BaseApiHelper {
  public async shareEntityByLink(
    entities: Conversation[] | Prompt[],
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
        resources.push({ url: ItemUtil.getEncodedItemId(url) });
      }

      if ('messages' in entity) {
        entity.messages.map((m) =>
          m.custom_content?.attachments?.forEach((a) => {
            if (a.reference_url === undefined) {
              resources.push({ url: a.url! });
            }
          }),
        );
        entity.playback?.messagesStack.map((m) =>
          m.custom_content?.attachments?.forEach((a) => {
            if (a.reference_url === undefined) {
              resources.push({ url: a.url! });
            }
          }),
        );
      }
    }

    // for (const r of resources) {
    //   r.url = ItemUtil.getEncodedItemId(r.url);
    // }

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

  public async listSharedWithMeFiles() {
    return this.listSharedWithMeEntities(BackendResourceType.FILE);
  }

  public async listSharedWithMeConversations() {
    return this.listSharedWithMeEntities(BackendResourceType.CONVERSATION);
  }

  public async listSharedWithMePrompts() {
    return this.listSharedWithMeEntities(BackendResourceType.PROMPT);
  }

  public async listSharedWithMeEntities(resourceType: BackendResourceType) {
    const requestData: ShareListingRequestModel = {
      resourceTypes: [resourceType],
      with: ShareRelations.me,
      order: 'popular_asc',
    };
    const response = await this.request.post(API.shareListing, {
      data: requestData,
    });
    const statusCode = response.status();
    if (statusCode == 200) {
      return (await response.json()) as {
        resources: BackendChatEntity[];
      };
    } else {
      expect(
        statusCode,
        `Received response code: ${statusCode} with body: ${await response.text()}`,
      ).toBe(200);
      return { resources: [] };
    }
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
