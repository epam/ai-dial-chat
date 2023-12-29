import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Rate, Side } from '@/e2e/src/testData';
import { Attributes, Tags } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { IconSelectors } from '@/e2e/src/ui/selectors/iconSelectors';
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

  public async isResponseLoading() {
    const loadingCursorCount = await this.loadingCursor.getElementsCount();
    return loadingCursorCount > 0;
  }

  public getChatMessage(message: string, index?: number) {
    return index
      ? this.chatMessages.getElementLocatorByText(message).nth(index - 1)
      : this.chatMessages.getElementLocatorByText(message).last();
  }

  public getChatMessageRate(message: string, rate: Rate) {
    return this.getChatMessage(message).locator(ChatSelectors.rate(rate));
  }

  public async getGeneratedChatContent(messagesCount: number) {
    const chatContent = await this.chatMessages.getElementsInnerContent();
    return chatContent.slice(0, messagesCount - 1).join('\n');
  }

  public async getLastMessageContent() {
    const messagesCount = await this.chatMessages.getElementsCount();
    return this.chatMessages.getNthElement(messagesCount).innerText();
  }

  public async getIconAttributesForMessage(index?: number) {
    const messagesCount = await this.chatMessages.getElementsCount();
    const messageIcon = await this.chatMessages.getNthElement(
      index ?? messagesCount,
    );
    return this.getElementIconHtml(messageIcon);
  }

  public async getMessageIconSize(index?: number) {
    const messagesCount = await this.chatMessages.getElementsCount();
    const icon = await this.chatMessages
      .getNthElement(index ?? messagesCount)
      .locator(Tags.svg)
      .first();
    await icon.waitFor();
    const iconBounding = await icon.boundingBox();
    return {
      width: Number(iconBounding!.width.toFixed(2)),
      height: Number(iconBounding!.height.toFixed(2)),
    };
  }

  public async waitForCompareMessageJumpingIconDisappears(
    comparedMessageSide: Side,
  ) {
    const compareRowMessage =
      await this.getCompareRowMessage(comparedMessageSide);
    await compareRowMessage
      .locator(ChatSelectors.iconAnimation)
      .locator(Tags.svg)
      .first()
      .waitFor({ state: 'detached' });
  }

  public async getMessageJumpingIcon(index?: number) {
    const messagesCount = await this.chatMessages.getElementsCount();
    return this.chatMessages
      .getNthElement(index ?? messagesCount)
      .locator(ChatSelectors.iconAnimation)
      .locator(Tags.svg)
      .first();
  }

  public async getCompareMessageJumpingIcon(
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    const compareRowMessage = await this.getCompareRowMessage(
      comparedMessageSide,
      rowIndex,
    );
    return compareRowMessage
      .locator(ChatSelectors.iconAnimation)
      .locator(Tags.svg)
      .first();
  }

  public async getIconAttributesForCompareMessage(
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    const compareRowMessage = await this.getCompareRowMessage(
      comparedMessageSide,
      rowIndex,
    );
    return this.getElementIconHtml(compareRowMessage);
  }

  public async getCompareMessagesCount() {
    return this.compareChatMessages.getElementsCount();
  }

  public async getCompareMessageRow(rowIndex?: number) {
    const rowsCount = await this.compareChatMessageRows.getElementsCount();
    return this.compareChatMessageRows.getNthElement(rowIndex ?? rowsCount);
  }

  public async getCompareRowMessage(
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    const compareChatMessageRow = await this.getCompareMessageRow(rowIndex);
    const messageIndex = comparedMessageSide === Side.left ? 0 : 1;
    return compareChatMessageRow
      .locator(ChatSelectors.chatMessage)
      .nth(messageIndex);
  }

  public async getCompareRowMessageRate(
    comparedMessageSide: Side,
    rate: Rate,
    rowIndex?: number,
  ) {
    const compareRowMessage = await this.getCompareRowMessage(
      comparedMessageSide,
      rowIndex,
    );
    return compareRowMessage.locator(ChatSelectors.rate(rate));
  }

  public async rateCompareRowMessage(
    comparedMessageSide: Side,
    rate: Rate,
    rowIndex?: number,
  ) {
    const thumb = await this.getCompareRowMessageRate(
      comparedMessageSide,
      rate,
      rowIndex,
    );
    await thumb.hover({ force: true });
    await thumb.waitFor();
    await thumb.click();
  }

  public async isComparedRowMessageRated(
    comparedMessageSide: Side,
    rate: Rate,
    rowIndex?: number,
  ) {
    const thumb = await this.getCompareRowMessageRate(
      comparedMessageSide,
      rate,
      rowIndex,
    );
    return thumb.isVisible();
  }

  public async openDeleteCompareRowMessageDialog(
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    await this.invokeCompareRowMessageAction(
      IconSelectors.deleteIcon,
      comparedMessageSide,
      rowIndex,
    );
  }

  public async openEditCompareRowMessageMode(
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    await this.invokeCompareRowMessageAction(
      IconSelectors.editIcon,
      comparedMessageSide,
      rowIndex,
    );
  }

  public async copyCompareRowMessage(
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    await this.invokeCompareRowMessageAction(
      IconSelectors.copyIcon,
      comparedMessageSide,
      rowIndex,
    );
  }

  public async invokeCompareRowMessageAction(
    selector: string,
    comparedMessageSide: Side,
    rowIndex?: number,
  ) {
    const messageToCopy = await this.getCompareRowMessage(
      comparedMessageSide,
      rowIndex,
    );
    await messageToCopy.hover();
    const copyIcon = await messageToCopy.locator(selector);
    await copyIcon.waitFor();
    await copyIcon.click();
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

  public messageEditIcon = (message: string) =>
    this.getChatMessage(message).locator(IconSelectors.editIcon);
  public saveAndSubmit = new BaseElement(
    this.page,
    ChatSelectors.saveAndSubmit,
  );
  public cancel = new BaseElement(this.page, ChatSelectors.cancelEdit);

  public messageDeleteIcon = (message: string) =>
    this.getChatMessage(message).locator(IconSelectors.deleteIcon);

  public async openEditMessageMode(message: string) {
    const chatMessage = await this.getChatMessage(message);
    await chatMessage.hover();
    const editIcon = this.messageEditIcon(message);
    await editIcon.waitFor();
    await editIcon.click();
  }

  public async editMessage(oldMessage: string, newMessage: string) {
    await this.fillEditData(oldMessage, newMessage);
    await this.saveAndSubmit.click();
    await this.waitForResponseReceived();
  }

  public async fillEditData(oldMessage: string, newMessage: string) {
    const textArea = await this.clearEditTextarea(oldMessage);
    await textArea.fill(newMessage);
  }

  public async clearEditTextarea(oldMessage: string) {
    const textArea = this.getChatMessageTextarea(oldMessage);
    await textArea.waitFor();
    await textArea.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    return textArea;
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

  public async isArrowIconVisibleForMessage(index?: number) {
    const messagesCount = await this.chatMessages.getElementsCount();
    return this.chatMessages
      .getNthElement(index ?? messagesCount)
      .locator(ChatSelectors.messageIcon)
      .locator(ChatSelectors.arrowAdditionalIcon)
      .isVisible();
  }
}
