import { ElementLabel, ElementState, ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { ChatMessages } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatMessagesAssertion {
  readonly chatMessages: ChatMessages;

  constructor(chatMessages: ChatMessages) {
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
}
