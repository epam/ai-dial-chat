import { ApproveRequiredEntitiesTree } from './approveRequiredEntitiesTree';

import { ChatBarSelectors, EntitySelectors } from '@/src/ui/selectors';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredConversationsTree extends ApproveRequiredEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.approveRequiredConversations(),
      EntitySelectors.conversation,
    );
  }
}
