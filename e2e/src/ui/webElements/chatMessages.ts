import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { Page } from '@playwright/test';

export class ChatMessages extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chatMessages);
  }

  public loadingCursor = new BaseElement(
    this.page,
    ChatSelectors.loadingCursor,
  );

  public chatMessages = this.getChildElementBySelector(
    ChatSelectors.chatMessage,
  );

  public messageStage = (messagesIndex: number, stageIndex: number) =>
    this.chatMessages
      .getNthElement(messagesIndex)
      .locator(ChatSelectors.messageStage)
      .nth(stageIndex - 1);

  public messageStageLoader = (messagesIndex: number, stageIndex: number) =>
    this.messageStage(messagesIndex, stageIndex).locator(
      ChatSelectors.stageLoader,
    );

  public async waitForResponseReceived() {
    await this.loadingCursor.waitForState({
      state: 'detached',
    });
  }

  public getChatMessage(message: string) {
    return this.chatMessages.getElementLocatorByText(message);
  }

  public async getGeneratedChatContent(messagesCount: number) {
    const chatContent = await this.chatMessages.getElementsInnerContent();
    return chatContent.slice(0, messagesCount - 1).join('\n');
  }

  public async waitForPartialMessageReceived(messagesIndex: number) {
    let isReceived = false;
    while (!isReceived) {
      const lastMessage = await this.chatMessages.getNthElement(messagesIndex);
      const lastMessageContent = await lastMessage.innerText();
      if (lastMessageContent.match(/.{2,}/g)) {
        isReceived = true;
      }
    }
  }

  public async waitForMessageStageReceived(
    messagesIndex: number,
    stageIndex: number,
  ) {
    await this.messageStage(messagesIndex, stageIndex).waitFor();
    let isLoaded = false;
    while (!isLoaded) {
      if (await this.messageStageLoader(messagesIndex, stageIndex).isHidden()) {
        isLoaded = true;
      }
    }
  }

  public async isMessageStageReceived(
    messagesIndex: number,
    stageIndex: number,
  ) {
    return this.messageStage(messagesIndex, stageIndex).isVisible();
  }

  public getChatMessageTextarea(message: string) {
    return this.getChatMessage(message).locator(Tags.textarea);
  }

  public editIcon = new BaseElement(this.page, ChatSelectors.editIcon);
  public saveAndSubmit = new BaseElement(
    this.page,
    ChatSelectors.saveAndSubmit,
  );

  public async openEditMessageMode(message: string) {
    const chatMessage = await this.getChatMessage(message);
    await chatMessage.hover();
    await this.editIcon.click();
  }

  public async editMessage(currentMessage: string, newMessage: string) {
    const textArea = this.getChatMessageTextarea(currentMessage);
    await textArea.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await textArea.fill(newMessage);
    await this.saveAndSubmit.click();
    await this.waitForResponseReceived();
  }
}
