import {
  EntityTreeSelectors,
  PublishingApprovalModalSelectors,
} from '../../../selectors';

import { PublishEntities } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApplicationsToApprove extends PublishEntities {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.applicationsToApproveContainer,
      EntityTreeSelectors.application,
    );
  }
}
