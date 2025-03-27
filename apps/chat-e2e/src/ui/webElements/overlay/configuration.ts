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

  public async setConfiguration() {
    const respPromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.status() === 200,
    );
    await this.setConfigurationButton.click();
    await respPromise;
  }
}
