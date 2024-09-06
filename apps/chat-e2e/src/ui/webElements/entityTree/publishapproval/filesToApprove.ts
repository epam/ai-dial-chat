import {
  EntityTreeSelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishFiles } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FilesToApprove extends PublishFiles {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.filesToApproveContainer,
      EntityTreeSelectors.file,
    );
  }
}
