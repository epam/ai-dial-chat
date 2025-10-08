import {
  EntitySelectors,
  PublishingDialogSelectors,
  PublishingTreeSelectors,
} from '@/src/ui/selectors';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publishFilesTree';
import { Locator, Page } from '@playwright/test';

export class FilesToPublishTree extends PublishFilesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingTreeSelectors.filesTree,
      EntitySelectors.file,
    );
  }

  public noPublishingFilesMessage = this.getChildElementBySelector(
    PublishingDialogSelectors.noPublishingFilesMessage,
  );
}
