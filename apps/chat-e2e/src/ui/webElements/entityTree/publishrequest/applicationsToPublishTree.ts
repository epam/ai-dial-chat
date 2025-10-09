import { EntitySelectors, PublishingTreeSelectors } from '../../../selectors';

import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class ApplicationsToPublishTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingTreeSelectors.appsTree,
      EntitySelectors.application,
    );
  }
}
