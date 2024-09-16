import {
  EntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FilesToApproveTree extends PublishFilesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.filesToApproveContainer,
      EntitySelectors.file,
    );
  }
}
