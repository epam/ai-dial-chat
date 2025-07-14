import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { EventSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { ItemUtil } from '@/src/utils';
import { Page } from '@playwright/test';
import * as process from 'node:process';
import { Response } from 'playwright-core';

export class Actions extends BaseElement {
  constructor(page: Page) {
    super(page, EventSelectors.chatActionsContainer);
  }

  public sendMessageButton = this.getChildElementBySelector(
    EventSelectors.sendMessageButton,
  );
  public setSysPromptButton = this.getChildElementBySelector(
    EventSelectors.setSysPromptButton,
  );
  public getMessagesButton = this.getChildElementBySelector(
    EventSelectors.getMessagesButton,
  );
  public getConversationsButton = this.getChildElementBySelector(
    EventSelectors.getConversationsButton,
  );
  public createConversationButton = this.getChildElementBySelector(
    EventSelectors.createConversationButton,
  );
  public createConversationInFolderButton = this.getChildElementBySelector(
    EventSelectors.createConversationInFolderButton,
  );
  public selectConversationByIdButton = this.getChildElementBySelector(
    EventSelectors.selectConversationByIdButton,
  );
  public conversationIdField = this.getChildElementBySelector(
    EventSelectors.conversationIdField,
  );

  public async clickSendMessage() {
    const requestPromise = this.page.waitForRequest(
      process.env.NEXT_PUBLIC_OVERLAY_HOST + API.chatHost,
    );
    await this.sendMessageButton.click();
    const request = await requestPromise;
    return request.postDataJSON();
  }

  public async clickCreateConversation() {
    return this.clickCreateConversationButton(() =>
      this.createConversationButton.click(),
    );
  }

  public async clickCreateConversationInInnerFolder(folderPath: string) {
    return this.clickCreateConversationButton(
      () => this.createConversationInFolderButton.click(),
      folderPath,
    );
  }

  private async clickCreateConversationButton(
    method: () => Promise<void>,
    url?: string,
  ) {
    const predicate = (response: Response) => {
      const isPostRequestWithOkStatus =
        response.request().method() === 'POST' && response.status() === 200;
      if (!url) {
        return isPostRequestWithOkStatus;
      }
      return (
        isPostRequestWithOkStatus &&
        response.url().includes(ItemUtil.getEncodedItemId(url))
      );
    };

    const respPromise = this.page.waitForResponse((response) =>
      predicate(response),
    );
    await method();
    const response = await respPromise;
    const responseBody = (await response.json()) as BackendChatEntity;
    return {
      request: response.request().postDataJSON() as Conversation,
      response: responseBody,
    };
  }
}
