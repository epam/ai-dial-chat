import { ChatBarSelectors, EntitySelectors } from '../../../selectors';

import { BaseSideBarConversation } from '@/src/ui/webElements/entityTree/sidebar/baseSideBarConversation';
import { Locator, Page } from '@playwright/test';

export class SharedWithMeConversations extends BaseSideBarConversation {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.sharedWithMeChats(),
      EntitySelectors.conversation,
    );
  }
}
