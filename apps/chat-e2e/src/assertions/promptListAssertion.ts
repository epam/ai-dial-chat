import { ElementState, ExpectedMessages } from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { PromptList } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PromptListAssertion {
  readonly promptList: PromptList;

  constructor(promptList: PromptList) {
    this.promptList = promptList;
  }

  public async assertPromptOptionOverflow(
    name: string,
    expectedOverflow: Overflow,
  ) {
    const promptOptionOverflow = await this.promptList
      .getPromptOption(name)
      .getComputedStyleProperty(Styles.text_overflow);
    expect
      .soft(promptOptionOverflow[0], ExpectedMessages.entityNameIsTruncated)
      .toBe(expectedOverflow);
  }

  public async assertPromptListState(expectedState: ElementState) {
    expectedState === 'visible'
      ? await expect
          .soft(
            this.promptList.getElementLocator(),
            ExpectedMessages.promptListIsVisible,
          )
          .toBeVisible()
      : await expect
          .soft(
            this.promptList.getElementLocator(),
            ExpectedMessages.promptListIsHidden,
          )
          .toBeHidden();
  }

  public async assertPromptListOptions(
    expectedIncludedOptions: string[],
    expectedExcludedOptions?: string[],
  ) {
    const listOptions = await this.promptList
      .getPromptOptions()
      .getElementsInnerContent();
    for (const includedOption of expectedIncludedOptions) {
      expect
        .soft(listOptions, ExpectedMessages.promptListValuesIsValid)
        .toContain(includedOption);
    }
    if (expectedExcludedOptions) {
      for (const excludedOption of expectedExcludedOptions) {
        expect
          .soft(listOptions, ExpectedMessages.promptListValuesIsValid)
          .not.toContain(excludedOption);
      }
    }
  }
}
