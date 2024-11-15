import { EntitySelectors, PublishingModalSelectors } from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class PromptsToPublishTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.promptsToPublishContainer,
      EntitySelectors.prompt,
    );
  }
}
