import { ExpectedMessages } from '@/src/testData';
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
}
