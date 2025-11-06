import { ElementCaretState, ExpectedMessages } from '@/src/testData';
import { AccountSettings } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class AccountSettingsAssertion {
  readonly accountSettings: AccountSettings;

  constructor(accountSettings: AccountSettings) {
    this.accountSettings = accountSettings;
  }

  public async assertCaretState(expectedState: ElementCaretState) {
    const caret = this.accountSettings.accountSettingsCaret.getElementLocator();
    expectedState === 'expanded'
      ? await expect.soft(caret, ExpectedMessages.caretIsExpanded).toBeVisible()
      : await expect
          .soft(caret, ExpectedMessages.caretIsCollapsed)
          .toBeHidden();
  }
}
