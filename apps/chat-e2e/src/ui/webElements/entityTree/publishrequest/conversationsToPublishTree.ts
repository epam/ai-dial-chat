import { EntitySelectors, PublishingDialogSelectors } from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class ConversationsToPublishTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingDialogSelectors.conversationsToPublishContainer,
      EntitySelectors.conversation,
    );
  }
}
