import { API } from '@/src/testData';
import { EntitySelectors, PromptBarSelectors } from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredPrompts extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.approveRequiredPrompts(),
      EntitySelectors.prompt,
    );
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
}
