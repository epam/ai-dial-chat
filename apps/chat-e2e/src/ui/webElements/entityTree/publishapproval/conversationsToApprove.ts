import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishEntities } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ConversationsToApprove extends PublishEntities {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.conversationsToApproveContainer,
      EntitySelectors.conversation,
    );
  }
}
