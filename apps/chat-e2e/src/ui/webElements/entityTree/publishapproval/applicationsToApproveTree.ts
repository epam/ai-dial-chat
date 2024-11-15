import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '../../../selectors';

import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApplicationsToApproveTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.applicationsToApproveContainer,
      EntitySelectors.application,
    );
  }
}
