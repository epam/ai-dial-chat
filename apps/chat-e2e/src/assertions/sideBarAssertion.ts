import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { SideBar } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SideBarAssertion extends BaseAssertion {
  readonly sideBar: SideBar;

  constructor(sideBar: SideBar) {
    super();
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

  public async assertNoDataInConversations() {
    await this.assertElementState(
      this.sideBar.noDataIcon,
      'visible',
      ExpectedMessages.entityIsVisible,
    );
    await this.assertElementState(
      this.sideBar.noDataPlaceholder,
      'visible',
      ExpectedMessages.entityIsVisible,
    );
    await this.assertElementText(
      this.sideBar.noDataPlaceholder,
      'No data',
      ExpectedMessages.noData,
    );
  }
}
