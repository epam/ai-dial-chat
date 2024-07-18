import { ExpectedMessages } from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { ChatHeader } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatHeaderAssertion {
  readonly chatHeader: ChatHeader;

  constructor(chatHeader: ChatHeader) {
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
}
