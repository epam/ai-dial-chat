import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ChatHeader } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatHeaderAssertion<T extends ChatHeader> extends BaseAssertion {
  readonly chatHeader: T;

  constructor(chatHeader: T) {
    super();
    this.chatHeader = chatHeader;
  }

  public async assertHeaderTitle(expectedTitle: string) {
    await this.assertElementText(
      this.chatHeader.chatTitle,
      expectedTitle,
      ExpectedMessages.headerTitleIsValid,
    );
  }

  public async assertHeaderWidth(option: { hasFullWidth: boolean }) {
    await this.assertElementWidthStyle(this.chatHeader.chatTitle, option);
  }

  public async assertClearButtonState(expectedState: ElementState) {
    const clearButton = this.chatHeader.clearConversation.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(clearButton, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(clearButton, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertHeaderIcon(expectedIcon: string) {
    await super.assertEntityIcon(
      await this.chatHeader.getHeaderModelIcon(),
      expectedIcon,
    );
  }
}
