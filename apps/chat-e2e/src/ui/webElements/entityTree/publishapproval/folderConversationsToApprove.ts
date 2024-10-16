import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishFolder } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FolderConversationsToApprove extends PublishFolder {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.conversationsToApproveContainer,
      EntitySelectors.conversation,
    );
  }
}
