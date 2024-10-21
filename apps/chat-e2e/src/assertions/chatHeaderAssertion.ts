import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { ChatHeader } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatHeaderAssertion<T extends ChatHeader> extends BaseAssertion {
  readonly chatHeader: T;

  constructor(chatHeader: T) {
    super();
    this.chatHeader = chatHeader;
  }

  public async assertHeaderWidth(option: { hasFullWidth: boolean }) {
    const headerTitleWidth =
      await this.chatHeader.chatTitle.getComputedStyleProperty(Styles.maxWidth);
    option.hasFullWidth
      ? expect
          .soft(headerTitleWidth[0], ExpectedMessages.elementWidthIsValid)
          .toBe(Styles.none)
      : expect
          .soft(headerTitleWidth[0], ExpectedMessages.elementWidthIsValid)
          .not.toBe(Styles.none);
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
