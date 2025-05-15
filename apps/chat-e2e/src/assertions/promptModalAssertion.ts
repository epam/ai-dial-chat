import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement, PromptModalDialog } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class PromptModalAssertion extends BaseAssertion {
  readonly promptModalDialog: PromptModalDialog;

  constructor(promptModalDialog: PromptModalDialog) {
    super();
    this.promptModalDialog = promptModalDialog;
  }

  public async assertFieldIsInvalid(
    element: BaseElement,
    expectedErrorMessage: string,
  ) {
    await this.assertElementBorderColors(
      element,
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
    );
    const nameFieldErrorMessage =
      this.promptModalDialog.getFieldBottomMessage(element);
    await this.assertElementText(nameFieldErrorMessage, expectedErrorMessage);
  }

  public async assertNameFieldIsInvalid(expectedErrorMessage: string) {
    await this.assertFieldIsInvalid(
      this.promptModalDialog.name,
      expectedErrorMessage,
    );
  }

  public async assertPromptFieldIsInvalid(expectedErrorMessage: string) {
    await this.assertFieldIsInvalid(
      this.promptModalDialog.prompt,
      expectedErrorMessage,
    );
  }

  public async assertNameFieldIsEmpty() {
    expect
      .soft(
        await this.promptModalDialog.getName(),
        ExpectedMessages.charactersAreNotDisplayed,
      )
      .toBe('');
  }

  public async assertPromptName(expectedPromptName: string) {
    expect
      .soft(
        await this.promptModalDialog.getName(),
        ExpectedMessages.promptNameValid,
      )
      .toBe(expectedPromptName);
  }

  public async assertPromptDescription(expectedValue: string | undefined) {
    expect
      .soft(
        await this.promptModalDialog.getDescription(),
        ExpectedMessages.promptDescriptionValid,
      )
      .toBe(expectedValue ?? '');
  }

  public async assertPromptContent(expectedValue: string) {
    expect
      .soft(
        await this.promptModalDialog.getPrompt(),
        ExpectedMessages.promptContentValid,
      )
      .toBe(expectedValue);
  }
}
