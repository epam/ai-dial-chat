import { EventSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class Configuration extends BaseElement {
  constructor(page: Page) {
    super(page, EventSelectors.configurationContainer);
  }

  public setConfigurationButton = this.getChildElementBySelector(
    EventSelectors.setConfigurationButton,
  );

  // Setting overlay options no longer re-reads the selected conversation, so
  // there is no response to wait for; the assertions that follow retry on their
  // own until the options are applied.
  public async clickSetConfigurationButton() {
    await this.setConfigurationButton.click();
  }
}
