import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { StyleValues, Styles } from '@/src/ui/domData';
import { ChatHeader } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatHeaderAssertion<T extends ChatHeader> extends BaseAssertion {
  readonly chatHeader: T;

  constructor(chatHeader: T) {
    super();
    this.chatHeader = chatHeader;
  }

  public async assertHeaderTitle(expectedTitle: string) {
    await expect
      .soft(
        this.chatHeader.chatTitle.getElementLocator(),
        ExpectedMessages.headerTitleIsValid,
      )
      .toHaveText(expectedTitle);
  }

  public async assertHeaderWidth(option: { hasFullWidth: boolean }) {
    const headerTitleWidth =
      await this.chatHeader.chatTitle.getComputedStyleProperty(Styles.maxWidth);
    option.hasFullWidth
      ? expect
          .soft(headerTitleWidth[0], ExpectedMessages.elementWidthIsValid)
          .toBe(StyleValues.none)
      : expect
          .soft(headerTitleWidth[0], ExpectedMessages.elementWidthIsValid)
          .not.toBe(StyleValues.none);
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

  public async assertHeaderAddonIcon(expectedAddonIcons: string[]) {
    const actualAddonIcons = await this.chatHeader.getHeaderAddonsIcons();
    for (let i = 0; i < actualAddonIcons.length; i++) {
      await super.assertEntityIcon(
        actualAddonIcons[i].iconLocator,
        expectedAddonIcons[i],
      );
    }
  }
}
