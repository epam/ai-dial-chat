import { ElementState, ExpectedMessages } from '@/src/testData';
import { SideBar } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SideBarAssertion {
  readonly sideBar: SideBar;

  constructor(sideBar: SideBar) {
    this.sideBar = sideBar;
  }

  public async assertUnselectAllButtonState(expectedState: ElementState) {
    const buttonLocator = this.sideBar.unselectAllButton.getElementLocator();
    expectedState == 'visible'
      ? await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(buttonLocator, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }
}
