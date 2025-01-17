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
    await this.assertElementState(replayButton, expectedState);
  }

  public async assertAddAgentButtonState(expectedState: ElementState) {
    const addModelButton = this.chat.addModelButton.getElementLocator();
    await this.assertElementState(addModelButton, expectedState);
  }

  public async assertChangeAgentLinkState(expectedState: ElementState) {
    const changeAgentButton = this.chat.changeAgentButton.getElementLocator();
    await this.assertElementState(changeAgentButton, expectedState);
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
