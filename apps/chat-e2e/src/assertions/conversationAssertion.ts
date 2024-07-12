import {
  ChatBarEntity,
  CheckboxState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
import { BaseConversation } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ConversationAssertion {
  readonly conversation: BaseConversation;

  constructor(conversation: BaseConversation) {
    this.conversation = conversation;
  }

  public async assertConversationState(
    conversation: ChatBarEntity,
    expectedState: ElementState,
  ) {
    const conversationLocator = this.conversation.getConversationByName(
      conversation.name,
      conversation.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(conversationLocator, ExpectedMessages.conversationIsVisible)
          .toBeVisible()
      : await expect
          .soft(conversationLocator, ExpectedMessages.conversationIsNotVisible)
          .toBeHidden();
  }

  public async assertConversationCheckbox(
    conversation: ChatBarEntity,
    expectedState: ElementState,
  ) {
    const conversationCheckboxLocator =
      this.conversation.getConversationCheckbox(
        conversation.name,
        conversation.index,
      );
    expectedState === 'visible'
      ? await expect
          .soft(conversationCheckboxLocator, ExpectedMessages.entityIsChecked)
          .toBeVisible()
      : await expect
          .soft(
            conversationCheckboxLocator,
            ExpectedMessages.entityIsNotChecked,
          )
          .toBeHidden();
  }

  public async assertConversationCheckboxState(
    conversation: ChatBarEntity,
    expectedState: CheckboxState,
  ) {
    const message =
      expectedState === CheckboxState.checked
        ? ExpectedMessages.entityIsChecked
        : ExpectedMessages.entityIsNotChecked;
    expect
      .soft(
        await this.conversation.getConversationCheckboxState(
          conversation.name,
          conversation.index,
        ),
        message,
      )
      .toBe(expectedState);
  }

  public async assertConversationDotsMenuState(
    conversation: ChatBarEntity,
    expectedState: ElementState,
  ) {
    const dotsMenuLocator = this.conversation.getConversationDotsMenu(
      conversation.name,
      conversation.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(dotsMenuLocator, ExpectedMessages.dotsMenuIsVisible)
          .toBeVisible()
      : await expect
          .soft(dotsMenuLocator, ExpectedMessages.dotsMenuIsHidden)
          .toBeHidden();
  }
}
