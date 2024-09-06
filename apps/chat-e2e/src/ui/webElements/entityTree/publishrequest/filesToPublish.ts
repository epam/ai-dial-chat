import { EntitySelectors, PublishingModalSelectors } from '@/src/ui/selectors';
import { PublishFiles } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FilesToPublish extends PublishFiles {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.filesToPublishContainer,
      EntitySelectors.file,
    );
  }
}
