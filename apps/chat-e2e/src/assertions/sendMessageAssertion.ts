import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
import { getElementWidth } from '@/src/ui/domData';
import { SendMessage } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SendMessageAssertion extends BaseAssertion {
  readonly sendMessage: SendMessage;

  constructor(sendMessage: SendMessage) {
    super();
    this.sendMessage = sendMessage;
  }

  public async assertSendMessageWidth(
    initialWidth: number,
    option: { hasFullWidth: boolean },
  ) {
    const sendMessageInputFullWidth = await getElementWidth(this.sendMessage);
    option.hasFullWidth
      ? this.assertNumberIsGreaterThan(
          sendMessageInputFullWidth,
          initialWidth,
          ExpectedMessages.elementWidthIsValid,
        )
      : this.assertValue(
          sendMessageInputFullWidth,
          initialWidth,
          ExpectedMessages.elementWidthIsValid,
        );
  }

  public async assertMessageValue(expectedValue: string | undefined) {
    await super.assertElementText(
      this.sendMessage.messageInput,
      expectedValue ?? '',
      ExpectedMessages.messageContentIsValid,
    );
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

  public async assertInputFieldState(
    expectedState: ElementState,
    expectedActionability: ElementActionabilityState,
  ) {
    const messageInput = this.sendMessage.messageInput.getElementLocator();
    await this.assertElementState(messageInput, expectedState);
    await this.assertElementActionabilityState(
      messageInput,
      expectedActionability,
    );
  }
}
