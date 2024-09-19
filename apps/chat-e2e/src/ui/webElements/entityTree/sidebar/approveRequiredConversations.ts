import { ChatBarSelectors, EntitySelectors } from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredConversations extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.approveRequiredConversations(),
      EntitySelectors.conversation,
    );
  }
}
