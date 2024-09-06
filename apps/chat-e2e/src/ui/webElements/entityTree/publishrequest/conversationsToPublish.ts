import {
  EntityTreeSelectors,
  PublishingModalSelectors,
} from '@/src/ui/selectors';
import { PublishEntities } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ConversationsToPublish extends PublishEntities {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.conversationsToPublishContainer,
      EntityTreeSelectors.conversation,
    );
  }
}
