import { EntitySelectors, PublishingModalSelectors } from '../../../selectors';

import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApplicationsToPublishTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.appsToPublishContainer,
      EntitySelectors.application,
    );
  }
}
