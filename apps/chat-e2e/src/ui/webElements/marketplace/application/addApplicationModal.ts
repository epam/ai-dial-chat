import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { BackendEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { AddApplicationModalSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class AddApplicationModal extends BaseElement {
  constructor(page: Page) {
    super(page, AddApplicationModalSelector.modalContainer);
  }

  public name = this.getChildElementBySelector(
    AddApplicationModalSelector.name,
  );
  public version = this.getChildElementBySelector(
    AddApplicationModalSelector.version,
  );
  public chatCompletionUrl = this.getChildElementBySelector(
    AddApplicationModalSelector.chatCompletionUrl,
  );
  public addButton = this.getChildElementBySelector(
    AddApplicationModalSelector.addButton,
  );

  public async fillInAppFields(options: {
    name?: string;
    version?: string;
    chatCompletionUrl?: string;
  }) {
    if (options.name) {
      await this.name.fillInInput(options.name);
    }
    if (options.version) {
      await this.version.fillInInput(options.version);
    }
    const chatCompletionUrl =
      options.chatCompletionUrl ?? 'http://test.example.com';
    await this.chatCompletionUrl.fillInInput(chatCompletionUrl);
  }

  public async addApp() {
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
    await this.addButton.click();
    let requestBody;
    let responseBody;
    for (const resp of responses) {
      const resolvedResp = await resp;
      const host = resolvedResp.url();
      if (host.includes(API.applicationCreateHost)) {
        requestBody = resolvedResp.request().postDataJSON();
        responseBody = await resolvedResp.json();
      }
    }
    return {
      request: requestBody as ApiApplicationModelRegular,
      response: responseBody as BackendEntity,
    };
  }
}
