import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ConversationToCompare } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ConversationToCompareAssertion extends BaseAssertion {
  readonly conversationToCompare: ConversationToCompare;

  constructor(conversationToCompare: ConversationToCompare) {
    super();
    this.conversationToCompare = conversationToCompare;
  }

  public async assertConversationToCompareState(expectedState: ElementState) {
    const conversationToCompareLocator =
      this.conversationToCompare.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(
            conversationToCompareLocator,
            ExpectedMessages.conversationToCompareVisible,
          )
          .toBeVisible()
      : await expect
          .soft(
            conversationToCompareLocator,
            ExpectedMessages.conversationToCompareIsHidden,
          )
          .toBeHidden();
  }
}
