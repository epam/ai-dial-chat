import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementLabel,
  ElementState,
  ExpectedMessages,
  Rate,
} from '@/src/testData';
import {
  AttributeValues,
  Attributes,
  ThemeColorAttributes,
} from '@/src/ui/domData';
import { ChatMessages } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator, expect } from '@playwright/test';

export class ChatMessagesAssertion extends BaseAssertion {
  readonly chatMessages: ChatMessages;

  constructor(chatMessages: ChatMessages) {
    super();
    this.chatMessages = chatMessages;
  }

  public async assertMessagesWidth(option: { hasFullWidth: boolean }) {
    const messageMaxWidth = this.chatMessages.getChatMessageMaxWidth(1);
    await this.assertElementState(
      messageMaxWidth,
      option.hasFullWidth ? 'visible' : 'hidden',
      ExpectedMessages.elementWidthIsValid,
    );
  }

  public async assertShowMoreLessButtonState(
    label: ElementLabel,
    expectedState: ElementState,
  ) {
    const button =
      label === 'more'
        ? this.chatMessages.showMoreButton
        : this.chatMessages.showLessButton;
    expectedState === 'visible'
      ? await this.assertElementState(
          button,
          'visible',
          ExpectedMessages.buttonIsVisible,
        )
      : await this.assertElementState(
          button,
          'hidden',
          ExpectedMessages.buttonIsNotVisible,
        );
  }

  public async assertShowMoreLessButtonColor(
    label: ElementLabel,
    expectedColor: string,
  ) {
    const button =
      label === 'more'
        ? this.chatMessages.showMoreButton
        : this.chatMessages.showLessButton;
    await this.assertElementColor(button, expectedColor);
  }

  public async assertMessageStagesCount(
    messagesIndex: number,
    expectedCount: number,
  ) {
    await this.chatMessages.messageStage(messagesIndex, 0).waitFor();
    const stagesCount = this.chatMessages.messageStages(messagesIndex);
    await expect
      .soft(stagesCount, ExpectedMessages.elementsCountIsValid)
      .toHaveCount(expectedCount);
  }

  public async assertMessageContent(
    message: string | number,
    expectedContent: string,
  ) {
    const actualContent = this.chatMessages.getChatMessage(message);
    await expect
      .soft(actualContent, ExpectedMessages.messageContentIsValid)
      .toHaveText(expectedContent);
  }

  public async assertLastMessageContent(expectedContent: string) {
    const actualContent = await this.chatMessages.getLastMessageContent();
    expect
      .soft(actualContent.toLowerCase(), ExpectedMessages.messageContentIsValid)
      .toBe(expectedContent);
  }

  public async assertMessageEditIconState(
    message: string | number,
    expectedState: ElementState,
  ) {
    const chatMessage = this.chatMessages.getChatMessage(message);
    await chatMessage.scrollIntoViewIfNeeded();
    await chatMessage.hover();
    const editIcon = this.chatMessages.messageEditIcon(chatMessage);
    expectedState === 'visible'
      ? await expect
          .soft(editIcon, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(editIcon, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertSetMessageTemplateIconState(
    message: string | number,
    expectedState: ElementState,
  ) {
    const chatMessage = await this.chatMessages.hoverOverMessage(message);
    const templateIcon = this.chatMessages.setMessageTemplateIcon(chatMessage);
    expectedState === 'visible'
      ? await expect
          .soft(templateIcon, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(templateIcon, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertMessageDeleteIconState(
    message: string | number,
    expectedState: ElementState,
  ) {
    const chatMessage = this.chatMessages.getChatMessage(message);
    await chatMessage.hover();
    const deleteIcon = this.chatMessages.messageDeleteIcon(message);
    expectedState === 'visible'
      ? await expect
          .soft(deleteIcon, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(deleteIcon, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertMessageIcon(
    messageIndex: number | undefined,
    expectedIcon: string,
  ) {
    const messageIcon = await this.chatMessages.getMessageIcon(messageIndex);
    await this.assertEntityIcon(messageIcon, expectedIcon);
  }

  public async assertMessagesCount(
    expectedCount: number,
    expectedMessage?: string,
  ) {
    await super.assertElementsCount(
      this.chatMessages.chatMessages,
      expectedCount,
      expectedMessage,
    );
  }

  public async assertEditMessageInputState(
    message: string | number,
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.chatMessages.getChatMessageTextarea(message),
      expectedState,
      ExpectedMessages.messageContentIsValid,
    );
  }

  public async assertMessageAttachmentUrl(
    message: string | number,
    expectedUrl: string | null,
  ) {
    const attachmentUrl =
      await this.chatMessages.getChatMessageAttachmentUrl(message);
    expect
      .soft(attachmentUrl, ExpectedMessages.attachmentUrlIsValid)
      .toContain(expectedUrl);
  }

  public async assertMessageDownloadUrl(
    message: string | number,
    expectedUrl: string | null,
  ) {
    const downloadUrl =
      await this.chatMessages.getChatMessageDownloadUrl(message);
    expect
      .soft(downloadUrl, ExpectedMessages.attachmentUrlIsValid)
      .toContain(expectedUrl);
  }

  public async assertFullScreenMessageImageAttachment(
    message: string | number,
  ) {
    const openedImageAttachmentLocator =
      this.chatMessages.getOpenedChatMessageImageAttachment(message);
    for (const attribute of [
      AttributeValues.maxHFull,
      AttributeValues.maxWFull,
    ]) {
      await this.assertElementClass(
        openedImageAttachmentLocator,
        new RegExp(attribute),
        ExpectedMessages.attachmentIsOpenedOnFullScreen,
      );
    }
  }

  /**
   * The assertion depends on the expected state.
   * When 'visible' is passed, the image is verified to be loaded and to have a non-zero width
   */
  public async assertMessageImageAttachmentState(
    message: string | number | Locator,
    expectedState: ElementState,
  ) {
    const imgLocator =
      typeof message === 'string' || typeof message === 'number'
        ? this.chatMessages.getOpenedChatMessageImageAttachment(message)
        : message;
    expectedState === 'visible'
      ? await this.assertEntityIcon(imgLocator)
      : await this.assertElementState(imgLocator, expectedState);
  }

  public async assertMessageImageLoaded(message: number) {
    await this.assertEntityIcon(this.chatMessages.getChatMessageImage(message));
  }

  public async assertMessageImageLink(
    message: number,
    expectedLink: string | RegExp,
  ) {
    await this.assertElementAttribute(
      this.chatMessages.getAttachmentLink(message),
      Attributes.href,
      expectedLink,
    );
  }

  public async assertMessageImageOpenedInNewTab(message: number) {
    await this.assertElementAttribute(
      this.chatMessages.getAttachmentLink(message),
      Attributes.target,
      AttributeValues.blank,
    );
  }

  public async assertMessageImageDownloadName(
    message: number,
    expectedName: string,
  ) {
    await this.assertElementAttribute(
      this.chatMessages.getAttachmentLink(message),
      Attributes.download,
      expectedName,
    );
  }

  public assertCopiedMessage(copiedMessage: string, expectedMessage: string) {
    this.assertValue(copiedMessage.replace(/\r\n/g, '\n'), expectedMessage);
  }

  public async assertRate(rate: Rate, messageIndex: number) {
    const likeIcon = this.chatMessages.getChatMessageRate(messageIndex, rate);
    await this.assertElementState(likeIcon, 'visible');
    await this.assertElementActionabilityState(likeIcon, 'disabled');
    await this.assertElementColor(
      likeIcon,
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
    );
    await this.assertElementState(
      this.chatMessages.getChatMessageRate(
        messageIndex,
        rate === Rate.like ? Rate.dislike : Rate.like,
      ),
      'hidden',
    );
  }
}
