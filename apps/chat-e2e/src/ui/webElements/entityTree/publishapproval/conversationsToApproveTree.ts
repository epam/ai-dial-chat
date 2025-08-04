import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
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
