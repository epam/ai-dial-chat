import { BaseAssertion } from '@/src/assertions/baseAssertion';
import {
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { Chat } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatAssertion extends BaseAssertion {
  readonly chat: Chat;

  constructor(chat: Chat) {
    super();
    this.chat = chat;
  }

  public async assertReplayButtonState(expectedState: ElementState) {
    const replayButton = this.chat.replay.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(replayButton, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(replayButton, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertAddAgentButtonState(expectedState: ElementState) {
    const addModelButton = this.chat.addModelButton.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(addModelButton, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(addModelButton, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertChangeAgentLinkState(expectedState: ElementState) {
    const changeAgentButton = this.chat.changeAgentButton.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(changeAgentButton, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(changeAgentButton, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertNotAllowedModelLabelContent() {
    const notAllowedModelError =
      await this.chat.notAllowedModelLabel.getElementContent();
    expect
      .soft(
        notAllowedModelError!.trim(),
        ExpectedMessages.notAllowedModelErrorDisplayed,
      )
      .toBe(ExpectedConstants.notAllowedModelError);
  }

  public async assertDuplicateButtonState(expectedState: ElementState) {
    const duplicateButton = this.chat.duplicate.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(duplicateButton, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(duplicateButton, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }
}
