import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishEntities } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class PromptsToApprove extends PublishEntities {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.promptsToApproveContainer,
      EntitySelectors.prompt,
    );
  }
}
