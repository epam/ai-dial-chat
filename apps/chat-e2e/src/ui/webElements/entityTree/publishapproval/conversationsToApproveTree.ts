import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ConversationsToApproveTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.conversationsToApproveContainer,
      EntitySelectors.conversation,
    );
  }
}
