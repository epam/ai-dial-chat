import { EntitySelectors, PublishingDialogSelectors } from '../../../selectors';

import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class ApplicationsToPublishTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingDialogSelectors.appsToPublishContainer,
      EntitySelectors.application,
    );
  }
}
