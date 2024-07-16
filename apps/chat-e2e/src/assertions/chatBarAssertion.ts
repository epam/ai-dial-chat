import { ElementState, ExpectedMessages } from '@/src/testData';
import { ChatBar } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatBarAssertion {
  readonly chatBar: ChatBar;

  constructor(chatBar: ChatBar) {
    this.chatBar = chatBar;
  }

  public async assertUnselectAllButtonState(expectedState: ElementState) {
    const buttonLocator = this.chatBar.unselectAllButton.getElementLocator();
    expectedState == 'visible'
      ? await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }
}
