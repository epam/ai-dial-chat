import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { EventSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';
import * as process from 'node:process';

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
  public getSelectedConversationsButton = this.getChildElementBySelector(
    EventSelectors.getSelectedConversationsButton,
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
  public newConversationNameField = this.getChildElementBySelector(
    EventSelectors.newConversationNameField,
  );
  public createLocalConversationButton = this.getChildElementBySelector(
    EventSelectors.createLocalConversationButton,
  );
  public deleteConversationByIdButton = this.getChildElementBySelector(
    EventSelectors.deleteConversationByIdButton,
  );
  public playbackConversationByIdButton = this.getChildElementBySelector(
    EventSelectors.playbackConversationByIdButton,
  );
  public renameConversationByIdButton = this.getChildElementBySelector(
    EventSelectors.renameConversationByIdButton,
  );
  public exportConversationByIdButton = this.getChildElementBySelector(
    EventSelectors.exportConversationByIdButton,
  );
  public importedConversationField = this.getChildElementBySelector(
    EventSelectors.importedConversationField,
  );
  public importConversationButton = this.getChildElementBySelector(
    EventSelectors.importConversationButton,
  );

  public async clickSendMessage() {
    const requestPromise = this.page.waitForRequest(
      process.env.NEXT_PUBLIC_OVERLAY_HOST + API.chatHost,
    );
    await this.sendMessageButton.click();
    const request = await requestPromise;
    return request.postDataJSON();
  }

  public async clickDeleteConversationById() {
    const respPromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' && response.status() === 200,
    );
    await this.deleteConversationByIdButton.click();
    await respPromise;
  }

  public async clickRenameConversationById() {
    const respPromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && response.status() === 200,
    );
    await this.renameConversationByIdButton.click();
    const response = await respPromise;
    const responseBody = (await response.json()) as BackendChatEntity;
    return {
      request: response.request().postDataJSON() as Conversation,
      response: responseBody,
    };
  }

  public async clickImportConversation(conversationId: string) {
    const respPromise = this.page.waitForResponse(
      (response) =>
        response.url().includes(conversationId) &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    );
    await this.importConversationButton.click();
    await respPromise;
  }

  public async clickCreateConversation() {
    return this.clickCreateConversationButton(() =>
      this.createConversationButton.click(),
    );
  }

  public async clickCreateConversationInInnerFolder() {
    return this.clickCreateConversationButton(() =>
      this.createConversationInFolderButton.click(),
    );
  }

  public async clickPlaybackConversationById() {
    return this.clickCreateConversationButton(() =>
      this.playbackConversationByIdButton.click(),
    );
  }

  private async clickCreateConversationButton(method: () => Promise<void>) {
    const respPromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.status() === 200,
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
