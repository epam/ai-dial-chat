import { API } from '@/src/testData';
import { ChatBarSelectors, EntitySelectors } from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredConversationsTree extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.approveRequiredConversations(),
      EntitySelectors.conversation,
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

  public async selectRequestConversation(
    requestName: string,
    conversationName: string,
  ) {
    const responsePromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET',
    );
    await this.selectFolderEntity(requestName, conversationName);
    await responsePromise;
  }
}
