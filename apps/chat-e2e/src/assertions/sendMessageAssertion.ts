import { ElementState, ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { SendMessage } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SendMessageAssertion {
  readonly sendMessage: SendMessage;

  constructor(sendMessage: SendMessage) {
    this.sendMessage = sendMessage;
  }

  public async assertSendMessageWidth(
    initialWidth: number,
    option: { hasFullWidth: boolean },
  ) {
    const sendMessageInputFullWidth = await this.sendMessage
      .getComputedStyleProperty(Styles.width)
      .then((w) => +w[0].replace('px', ''));
    option.hasFullWidth
      ? expect
          .soft(sendMessageInputFullWidth, ExpectedMessages.elementWidthIsValid)
          .toBeGreaterThan(initialWidth)
      : expect
          .soft(sendMessageInputFullWidth, ExpectedMessages.elementWidthIsValid)
          .toBe(initialWidth);
  }

  public async assertMessageValue(expectedValue: string | undefined) {
    const messageValue = await this.sendMessage.getMessage();
    expect
      .soft(messageValue, ExpectedMessages.messageContentIsValid)
      .toBe(expectedValue ?? '');
  }

  public async assertContinueReplayButtonState(expectedState: ElementState) {
    const continueReplayButton =
      this.sendMessage.proceedGenerating.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(continueReplayButton, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(continueReplayButton, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertScrollDownButtonState(expectedState: ElementState) {
    const scrollDownButton =
      this.sendMessage.scrollDownButton.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(scrollDownButton, ExpectedMessages.scrollDownButtonIsVisible)
          .toBeVisible()
      : await expect
          .soft(scrollDownButton, ExpectedMessages.scrollDownButtonIsNotVisible)
          .toBeHidden();
  }
}
