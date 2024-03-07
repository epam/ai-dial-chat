import {
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
  ShareRequestModel,
  ShareRequestType,
} from '@/chat/types/share';
import { API, ExpectedConstants, TestConversation } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { expect } from '@playwright/test';

export class ShareApiHelper extends BaseApiHelper {
  public async shareConversationByLink(conversation: TestConversation) {
    const requestData: ShareRequestModel = {
      invitationType: ShareRequestType.link,
      resources: [{ url: conversation.id }],
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

  public async acceptInvite(shareLinkResponse: ShareByLinkResponseModel) {
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
    ).toBe(200);
  }
}
