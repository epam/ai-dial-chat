import { AttachFilesModalSelectors } from '../selectors';

import { Folders } from '@/src/ui/webElements/folders';
import { Locator, Page } from '@playwright/test';

export class FolderFiles extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      AttachFilesModalSelectors.allFilesContainer,
      AttachFilesModalSelectors.attachedFile,
    );
  }

  public attachedFolderFileName = (
    folderName: string,
    filename: string,
    folderIndex?: number,
  ) =>
    this.createElementFromLocator(
      this.getFolderEntity(folderName, filename, folderIndex).locator(
        AttachFilesModalSelectors.attachedFileName,
      ),
    );

  public attachedFolderFileIcon = (
    folderName: string,
    filename: string,
    folderIndex?: number,
  ) =>
    this.getFolderEntity(folderName, filename, folderIndex).locator(
      AttachFilesModalSelectors.attachedFileIcon,
    );

  public attachedFolderFileCheckBox = (
    folderName: string,
    filename: string,
    folderIndex?: number,
  ) =>
    this.attachedFolderFileIcon(folderName, filename, folderIndex).getByRole(
      'checkbox',
    );
}
