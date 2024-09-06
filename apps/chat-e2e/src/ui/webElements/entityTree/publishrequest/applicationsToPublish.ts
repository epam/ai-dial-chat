import {
  EntityTreeSelectors,
  PublishingModalSelectors,
} from '../../../selectors';

import { PublishEntities } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApplicationsToPublish extends PublishEntities {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.appsToPublishContainer,
      EntityTreeSelectors.application,
    );
  }
}
