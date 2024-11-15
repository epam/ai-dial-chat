import { EntitySelectors, PublishingModalSelectors } from '@/src/ui/selectors';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FilesToPublishTree extends PublishFilesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.filesToPublishContainer,
      EntitySelectors.file,
    );
  }

  public noPublishingFilesMessage = this.getChildElementBySelector(
    PublishingModalSelectors.noPublishingFilesMessage,
  );
}
