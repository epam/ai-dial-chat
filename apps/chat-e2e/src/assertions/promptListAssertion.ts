import { ElementState, ExpectedMessages } from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { PromptList } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class PromptListAssertion {
  readonly promptList: PromptList;

  constructor(promptList: PromptList) {
    this.promptList = promptList;
  }

  public async assertPromptOptionOverflow(name: string) {
    const promptOptionOverflow = await this.promptList
      .getPromptOption(name)
      .getComputedStyleProperty(Styles.text_overflow);
    expect
      .soft(promptOptionOverflow[0], ExpectedMessages.entityNameIsTruncated)
      .toBe(Overflow.ellipsis);
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

  public async assertPromptListIncludesOptions(expectedOptions: string[]) {
    expect
      .soft(
        await this.promptList.getPromptOptions().getElementsInnerContent(),
        ExpectedMessages.promptListValuesIsValid,
      )
      .toEqual(expect.arrayContaining(expectedOptions));
  }
}
