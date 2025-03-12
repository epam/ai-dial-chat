import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { BackendEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { ApplicationEditorHeader } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorHeader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ApplicationEditorHeader.header, parentLocator);
  }

  public saveAndExitButton = this.getChildElementBySelector(
    ApplicationEditorHeader.saveAndExitButton,
  );

  public async saveAppAndExit() {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(API.applicationCreateHost) &&
        resp.request().method() === 'PUT',
    );
    await this.saveAndExitButton.click();
    const resolvedResp = await respPromise;
    const requestBody = resolvedResp.request().postDataJSON();
    const responseBody = await resolvedResp.json();
    return {
      request: requestBody as ApiApplicationModelRegular,
      response: responseBody as BackendEntity,
    };
  }
}
