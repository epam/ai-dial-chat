import { EntitySelectors, PublishingTreeSelectors } from '@/src/ui/selectors';
import { PublishFolder } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class PublishFolderFiles extends PublishFolder {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingTreeSelectors.filesTree,
      EntitySelectors.file,
    );
  }
}
