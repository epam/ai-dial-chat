import { API } from '@/src/testData';
import { AddApplicationFormSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralForm extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationFormSelector.appGeneralFormContainer,
      parentLocator,
    );
  }

  public name = this.getChildElementBySelector(AddApplicationFormSelector.name);
  public version = this.getChildElementBySelector(
    AddApplicationFormSelector.version,
  );
  public nextButton = this.getChildElementBySelector(
    AddApplicationFormSelector.nextButton,
  );

  public async fillInAppFields(options: { name?: string; version?: string }) {
    if (options.name) {
      await this.name.fillInInput(options.name);
    }
    if (options.version) {
      await this.version.fillInInput(options.version);
    }
  }

  public async goNext() {
    const responses = [];
    const hostsArray = [
      API.applicationCreateHost,
      API.installedDeploymentsHost(),
    ];
    for (const host of hostsArray) {
      const resp = this.page.waitForResponse(
        (response) =>
          response.url().includes(host) &&
          (response.request().method() === 'POST' ||
            response.request().method() === 'PUT') &&
          response.status() === 200,
      );
      responses.push(resp);
    }
    await this.nextButton.click();
    for (const resp of responses) {
      await resp;
    }
  }
}
