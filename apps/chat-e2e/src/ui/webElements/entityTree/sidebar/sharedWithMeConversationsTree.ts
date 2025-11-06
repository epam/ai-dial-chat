import { ChatBarSelectors, EntitySelectors } from '../../../selectors';

import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class SharedWithMeConversationsTree extends SideBarEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.sharedWithMeChats(),
      EntitySelectors.conversation,
    );
  }
}
