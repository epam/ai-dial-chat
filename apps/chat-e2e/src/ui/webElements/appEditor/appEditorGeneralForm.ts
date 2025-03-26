import { API } from '@/src/testData';
import { AddApplicationGeneralInfoFormSelector } from '@/src/ui/selectors';
import { AppEditorForm } from '@/src/ui/webElements/appEditor/appEditorForm';
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralForm extends AppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationGeneralInfoFormSelector.appGeneralFormContainer,
      parentLocator,
    );
  }

  public name = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.name,
  );
  public version = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.version,
  );
  public description = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.description,
  );
  public topics = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.topics,
  );
  public nextButton = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.nextButton,
  );

  public async fillInAppFields(options: {
    name?: string;
    version?: string;
    description?: string;
  }) {
    if (options.name) {
      await this.name.fillInInput(options.name);
    }
    if (options.version) {
      await this.version.fillInInput(options.version);
    }
    if (options.description) {
      await this.description.fillInInput(options.description);
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
