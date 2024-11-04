import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ElementLabel, ElementState, ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { ChatMessages } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatMessagesAssertion extends BaseAssertion {
  readonly chatMessages: ChatMessages;

  constructor(chatMessages: ChatMessages) {
    super();
    this.chatMessages = chatMessages;
  }

  public async assertMessagesWidth(option: { hasFullWidth: boolean }) {
    const messageMaxWidth = this.chatMessages.getChatMessageMaxWidth(1);
    option.hasFullWidth
      ? await expect
          .soft(messageMaxWidth, ExpectedMessages.elementWidthIsValid)
          .toBeVisible()
      : await expect
          .soft(messageMaxWidth, ExpectedMessages.elementWidthIsValid)
          .toBeHidden();
  }

  public async assertShowMoreLessButtonState(
    label: ElementLabel,
    expectedState: ElementState,
  ) {
    const button =
      label === 'more'
        ? this.chatMessages.showMoreButton.getElementLocator()
        : this.chatMessages.showLessButton.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(button, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(button, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertShowMoreLessButtonColor(
    label: ElementLabel,
    expectedColor: string,
  ) {
    const button =
      label === 'more'
        ? this.chatMessages.showMoreButton
        : this.chatMessages.showLessButton;
    const color = await button.getComputedStyleProperty(Styles.color);
    expect
      .soft(color[0], ExpectedMessages.elementColorIsValid)
      .toBe(expectedColor);
  }

  public async assertMessageStagesCount(
    messagesIndex: number,
    expectedCount: number,
  ) {
    const stagesCount = await this.chatMessages
      .messageStages(messagesIndex)
      .count();
    expect
      .soft(stagesCount, ExpectedMessages.elementsCountIsValid)
      .toBe(expectedCount);
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

  public async assertMessagesCount(expectedCount: number) {
    const messagesCount =
      await this.chatMessages.chatMessages.getElementsInnerContent();
    expect
      .soft(messagesCount.length, ExpectedMessages.messageCountIsCorrect)
      .toBe(expectedCount);
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
}
