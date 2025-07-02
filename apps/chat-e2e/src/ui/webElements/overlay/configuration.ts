import { API } from '@/src/testData';
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

  public async clickSetConfigurationButton() {
    const respPromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.status() === 200 &&
        response.url().includes(API.conversationHost),
    );
    await this.setConfigurationButton.click();
    await respPromise;
  }
}
