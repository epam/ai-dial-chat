import { API } from '@/src/testData';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredEntitiesTree extends Folders {
  constructor(
    page: Page,
    parentLocator: Locator,
    selector: string,
    entitySelector: string,
  ) {
    super(page, parentLocator, selector, entitySelector);
  }

  public async expandApproveRequiredFolder(
    requestName: string,
    options: { isHttpMethodTriggered?: boolean; httpHost?: string } = {
      isHttpMethodTriggered: true,
      httpHost: API.publicationRequestDetails,
    },
  ) {
    await this.expandFolder(requestName, options);
  }

  public async selectRequestEntity(requestName: string, entityName: string) {
    const responsePromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET',
    );
    await this.selectFolderEntity(requestName, entityName);
    await responsePromise;
  }
}
