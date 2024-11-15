import { EntitySelectors, PublishingModalSelectors } from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ConversationsToPublishTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.conversationsToPublishContainer,
      EntitySelectors.conversation,
    );
  }
}
