import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Attributes, Tags } from '@/e2e/src/ui/domData';
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

  public compareChatMessageRows = this.getChildElementBySelector(
    ChatSelectors.compareChatMessage,
  );

  public compareChatMessages =
    this.compareChatMessageRows.getChildElementBySelector(
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
    const loadingCursorCount = await this.loadingCursor.getElementsCount();
    for (let i = 1; i <= loadingCursorCount; i++) {
      await this.loadingCursor.getNthElement(i).waitFor({
        state: 'detached',
      });
    }
  }

  public async waitForOneCompareConversationResponseReceived() {
    const loadingCursorCount = await this.loadingCursor.getElementsCount();
    if (loadingCursorCount === 2) {
      await this.waitForOneCompareConversationResponseReceived();
    }
  }

  public async isResponseLoading() {
    const loadingCursorCount = await this.loadingCursor.getElementsCount();
    return loadingCursorCount > 0;
  }

  public getChatMessage(message: string) {
    return this.chatMessages.getElementLocatorByText(message);
  }

  public async getGeneratedChatContent(messagesCount: number) {
    const chatContent = await this.chatMessages.getElementsInnerContent();
    return chatContent.slice(0, messagesCount - 1).join('\n');
  }

  public async getLastMessageContent() {
    const messagesCount = await this.chatMessages.getElementsCount();
    return this.chatMessages.getNthElement(messagesCount).innerText();
  }

  public async getLastMessageIconAttributes() {
    const messagesCount = await this.chatMessages.getElementsCount();
    const lastMessageIcon = await this.chatMessages
      .getNthElement(messagesCount)
      .locator(ChatSelectors.chatIcon);
    const iconEntity = await lastMessageIcon.getAttribute(Attributes.alt);
    const iconUrl = await lastMessageIcon.getAttribute(Attributes.src);
    return {
      iconEntity: iconEntity!.replaceAll(' icon', ''),
      iconUrl: iconUrl!,
    };
  }

  public async getCompareMessagesCount() {
    return this.compareChatMessages.getElementsCount();
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

  public getChatMessageTextarea() {
    return this.getChildElementBySelector(Tags.textarea);
  }

  public messageEditIcon = (message: string) =>
    this.getChatMessage(message).locator(ChatSelectors.editIcon);
  public saveAndSubmit = new BaseElement(
    this.page,
    ChatSelectors.saveAndSubmit,
  );
  public cancel = new BaseElement(this.page, ChatSelectors.cancelEdit);

  public messageDeleteIcon = (message: string) =>
    this.getChatMessage(message).locator(ChatSelectors.deleteIcon);

  public async openEditMessageMode(message: string) {
    const chatMessage = await this.getChatMessage(message);
    await chatMessage.hover();
    await this.messageEditIcon(message).click();
  }

  public async editMessage(newMessage: string) {
    await this.fillEditData(newMessage);
    await this.saveAndSubmit.click();
    await this.waitForResponseReceived();
  }

  public async fillEditData(newMessage: string) {
    const textArea = this.getChatMessageTextarea();
    await textArea.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await textArea.fillInInput(newMessage);
  }

  public async isSaveButtonEnabled() {
    const disabledAttributeValue = await this.saveAndSubmit.getAttribute(
      Attributes.disabled,
    );
    return disabledAttributeValue === undefined;
  }

  public async openDeleteMessageDialog(message: string) {
    const chatMessage = await this.getChatMessage(message);
    await chatMessage.hover();
    await this.messageDeleteIcon(message).click();
  }
}
