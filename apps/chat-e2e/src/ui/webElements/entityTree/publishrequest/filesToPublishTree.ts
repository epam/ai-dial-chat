import { EntitySelectors, PublishingDialogSelectors } from '@/src/ui/selectors';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publishFilesTree';
import { Locator, Page } from '@playwright/test';

export class FilesToPublishTree extends PublishFilesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingDialogSelectors.filesToPublishContainer,
      EntitySelectors.file,
    );
  }

  public noPublishingFilesMessage = this.getChildElementBySelector(
    PublishingDialogSelectors.noPublishingFilesMessage,
  );
}
