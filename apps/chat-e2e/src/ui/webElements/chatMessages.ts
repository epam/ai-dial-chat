import config from '../../../config/chat.playwright.config';
import {
  ChatSelectors,
  MessageInputSelectors,
  SideBarSelectors,
  TableSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Rate, Side } from '@/src/testData';
import { Attributes, Styles, Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { IconSelectors } from '@/src/ui/selectors/iconSelectors';
import { MenuSelectors } from '@/src/ui/selectors/menuSelectors';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { Locator, Page } from '@playwright/test';

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

  public regenerate = new BaseElement(this.page, ChatSelectors.regenerate);
  private inputAttachments!: InputAttachments;

  getInputAttachments(): InputAttachments {
    if (!this.inputAttachments) {
      this.inputAttachments = new InputAttachments(this.page, this.rootLocator);
    }
    return this.inputAttachments;
  }

  public messageStages = (messagesIndex: number) =>
    this.chatMessages
      .getNthElement(messagesIndex)
      .locator(ChatSelectors.messageStage);

  public messageStage = (messagesIndex: number, stageIndex: number) =>
    this.messageStages(messagesIndex).nth(stageIndex - 1);

  public messageStageLoader = (messagesIndex: number, stageIndex: number) =>
    this.messageStage(messagesIndex, stageIndex).locator(
      ChatSelectors.stageLoader,
    );

  public showMoreButton = this.getChildElementBySelector(
    ChatSelectors.showMore,
  );

  public showLessButton = this.getChildElementBySelector(
    ChatSelectors.showLess,
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

  public getChatMessage(message: string | number) {
    return typeof message === 'string'
      ? this.chatMessages.getElementLocatorByText(message).last()
      : this.chatMessages.getNthElement(message);
  }

  public getChatMessageRate(message: string | number, rate: Rate) {
    return this.getChatMessage(message).locator(ChatSelectors.rate(rate));
  }

  public getChatMessageAttachment(
    message: string | number,
    attachmentTitle: string,
  ) {
    return this.createElementFromLocator(
      this.getChatMessage(message).getByTitle(attachmentTitle),
    );
  }

  public getOpenedChatMessageAttachment(message: string | number) {
    return this.getChatMessage(message).getByAltText('Attachment image');
  }

  public getDownloadAttachmentIcon(message: string | number) {
    return this.getChatMessage(message).locator(
      `${Tags.a}[${Attributes.download}]`,
    );
  }

  public getChatMessageCodeBlock(message: string | number) {
    return this.getChatMessage(message).locator(ChatSelectors.codeBlock);
  }

  public getChatMessageTable(message: string | number) {
    return this.getChatMessage(message).locator(TableSelectors.tableContainer);
  }

  public getChatMessageTableControls(message: string | number) {
    return this.getChatMessageTable(message).locator(
      TableSelectors.tableControls,
    );
  }

  public getChatMessageTableCopyAsCsvIcon(message: string | number) {
    return this.getChatMessageTableControls(message).locator(
      TableSelectors.copyAsCsvIcon,
    );
  }

  public getChatMessageTableCopyAsTxtIcon(message: string | number) {
    return this.getChatMessageTableControls(message).locator(
      TableSelectors.copyAsTxtIcon,
    );
  }

  public getChatMessageTableCopyAsMdIcon(message: string | number) {
    return this.getChatMessageTableControls(message).locator(
      TableSelectors.copyAsMdIcon,
    );
  }

  public getChatMessageTableHeaderColumns(message: string | number) {
    return this.getChatMessageTable(message)
      .locator(Tags.table)
      .locator(Tags.thead)
      .locator(Tags.th);
  }

  public getChatMessageTableRows(message: string | number) {
    return this.getChatMessageTable(message)
      .locator(Tags.table)
      .locator(Tags.tbody)
      .locator(Tags.td);
  }

  public getMessageStage(messagesIndex: number, stageIndex: number) {
    return this.messageStage(messagesIndex, stageIndex).locator(
      ChatSelectors.openedStage,
    );
  }

  public getMessagePlotlyAttachment(message: string | number) {
    return this.getChatMessage(message).locator(ChatSelectors.plotlyContainer);
  }

  public getAttachmentLinkIcon(message: string | number) {
    return this.getChatMessage(message).locator(
      `${Tags.a}[${Attributes.href}]`,
    );
  }

  public getChatMessageMaxWidth(message: string | number) {
    return this.getChatMessage(message).locator(ChatSelectors.maxWidth);
  }

  public async expandChatMessageAttachment(
    message: string | number,
    attachmentTitle: string,
  ) {
    const isCollapsed = await this.getChatMessage(message)
      .locator(ChatSelectors.attachmentCollapsed)
      .isVisible();
    if (isCollapsed) {
      const messageAttachment = this.getChatMessageAttachment(
        message,
        attachmentTitle,
      );
      if (isApiStorageType) {
        const respPromise = this.page.waitForResponse(
          (resp) =>
            resp.request().method() === 'GET' &&
            resp.url().includes(attachmentTitle),
          { timeout: config.use!.actionTimeout! * 2 },
        );
        await messageAttachment.click();
        return respPromise;
      }
      await messageAttachment.click();
    }
  }

  public async collapseChatMessageAttachment(
    message: string | number,
    attachmentTitle: string,
  ) {
    const isExpanded = await this.getChatMessage(message)
      .locator(ChatSelectors.attachmentExpanded)
      .isVisible();
    if (isExpanded) {
      await this.getChatMessageAttachment(message, attachmentTitle).click();
    }
  }

  public async getChatMessageAttachmentUrl(message: string | number) {
    const openedMessageAttachment =
      this.getOpenedChatMessageAttachment(message);
    return openedMessageAttachment.getAttribute(Attributes.src);
  }

  public async getChatMessageDownloadUrl(message: string | number) {
    const openedMessageAttachment = this.getDownloadAttachmentIcon(message);
    return openedMessageAttachment.getAttribute(Attributes.href);
  }

  public getChatMessageAttachmentsGroup(message: string | number) {
    return this.getChatMessage(message).locator(ChatSelectors.attachmentsGroup);
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
    const messageIcon = this.chatMessages.getNthElement(index ?? messagesCount);
    return this.getElementIconHtml(messageIcon);
  }

  public async getMessageIconSize(index?: number) {
    const messagesCount = await this.chatMessages.getElementsCount();
    const icon = this.chatMessages
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
    // eslint-disable-next-line playwright/no-force-option
    await thumb.hover({ force: true });
    await thumb.waitFor();
    const respPromise = this.page.waitForResponse(
      (resp) => resp.request().method() === 'POST',
    );
    await thumb.click();
    return respPromise;
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
    const copyIcon = messageToCopy.locator(selector);
    await copyIcon.waitFor();
    await copyIcon.click();
  }

  public async waitForPartialMessageReceived(messagesIndex: number) {
    let isReceived = false;
    const lastMessage = this.chatMessages.getNthElement(messagesIndex);
    while (!isReceived) {
      const lastMessageContent = await lastMessage.innerText();
      if (lastMessageContent.match(/.{2,}/)) {
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

  public async isMessageStageOpened(messagesIndex: number, stageIndex: number) {
    return this.getMessageStage(messagesIndex, stageIndex).isVisible();
  }

  public async openMessageStage(messagesIndex: number, stageIndex: number) {
    const isStageOpened = await this.isMessageStageOpened(
      messagesIndex,
      stageIndex,
    );
    if (!isStageOpened) {
      await this.messageStage(messagesIndex, stageIndex).click();
    }
  }

  public async closeMessageStage(messagesIndex: number, stageIndex: number) {
    const isStageOpened = await this.isMessageStageOpened(
      messagesIndex,
      stageIndex,
    );
    if (isStageOpened) {
      await this.messageStage(messagesIndex, stageIndex).click();
    }
  }

  public getChatMessageTextarea(message: string | number) {
    return this.getChatMessage(message).locator(MessageInputSelectors.textarea);
  }

  public getChatMessageClipIcon(message: string | number) {
    return this.getChatMessage(message).locator(MenuSelectors.menuTrigger);
  }

  public async getChatMessageTableHeaderColumnsCount(message: string | number) {
    return this.getChatMessageTableHeaderColumns(message).count();
  }

  public async getChatMessageTableHeadersBackgroundColor(
    message: string | number,
  ) {
    return this.createElementFromLocator(
      this.getChatMessageTableHeaderColumns(message).nth(1),
    ).getComputedStyleProperty(Styles.backgroundColor);
  }

  public async getChatMessageTableRowsCount(message: string | number) {
    return this.getChatMessageTableRows(message).count();
  }

  public async getChatMessageTableRowsBackgroundColor(
    message: string | number,
  ) {
    return this.createElementFromLocator(
      this.getChatMessageTableRows(message).nth(1),
    ).getComputedStyleProperty(Styles.backgroundColor);
  }

  public messageEditIcon = (messageLocator: Locator) =>
    messageLocator.locator(IconSelectors.editIcon);
  public saveAndSubmit = this.getChildElementBySelector(
    MessageInputSelectors.saveAndSubmit,
  );
  public cancel = this.getChildElementBySelector(
    MessageInputSelectors.cancelEdit,
  );

  public messageDeleteIcon = (message: string) =>
    this.getChatMessage(message).locator(IconSelectors.deleteIcon);

  public async openEditMessageMode(message: string | number) {
    const editIcon = await this.waitForEditMessageIcon(message);
    await editIcon.click();
  }

  public async waitForEditMessageIcon(message: string | number) {
    const chatMessage = this.getChatMessage(message);
    await chatMessage.scrollIntoViewIfNeeded();
    await chatMessage.hover();
    const editIcon = this.messageEditIcon(chatMessage);
    await editIcon.waitFor();
    return editIcon;
  }

  public async editMessage(oldMessage: string, newMessage: string) {
    await this.fillEditData(oldMessage, newMessage);
    await this.saveAndSubmit.click();
    await this.waitForResponseReceived();
  }

  public async fillEditData(oldMessage: string | number, newMessage: string) {
    const textArea = await this.selectEditTextareaContent(oldMessage);
    await textArea.fill(newMessage);
  }

  public async selectEditTextareaContent(oldMessage: string | number) {
    const textArea = this.getChatMessageTextarea(oldMessage);
    await textArea.waitFor();
    await textArea.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    return textArea;
  }

  public async openDeleteMessageDialog(message: string) {
    const chatMessage = this.getChatMessage(message);
    await chatMessage.hover();
    await this.messageDeleteIcon(message).click();
  }

  public async isArrowIconVisibleForMessage(index?: number) {
    const messagesCount = await this.chatMessages.getElementsCount();
    return this.chatMessages
      .getNthElement(index ?? messagesCount)
      .locator(ChatSelectors.messageIcon)
      .locator(SideBarSelectors.arrowAdditionalIcon)
      .isVisible();
  }

  public async regenerateResponse(waitForAnswer = true) {
    await this.regenerate.click();
    if (waitForAnswer) {
      await this.waitForResponseReceived();
    }
  }
}
