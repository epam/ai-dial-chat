import { ChatBarSelectors, EntitySelectors } from '../../../selectors';

import { BaseSideBarConversationTree } from '@/src/ui/webElements/entityTree/sidebar/baseSideBarConversationTree';
import { Locator, Page } from '@playwright/test';

export class OrganizationConversationsTree extends BaseSideBarConversationTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.organizationConversations(),
      EntitySelectors.conversation,
    );
  }
}
