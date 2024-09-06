import {
  EntitySelectors,
  FileSelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FolderFilesToApprove extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.filesToApproveContainer,
      EntitySelectors.file,
    );
  }

  public folderFileDownloadIcon = (folderName: string, filename: string) =>
    this.getFolderEntity(folderName, filename).locator(
      `~${FileSelectors.downloadIcon}`,
    );
}
