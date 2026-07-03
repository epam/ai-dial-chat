import {
  EntitySelectors,
  ErrorLabelSelectors,
  FileSelectors,
  FolderSelectors,
  IconSelectors,
  PublishingDialogSelectors,
  PublishingTreeSelectors,
} from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class PublishFilesTree extends PublishEntitiesTree {
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

  public getFileDownloadIcon = (filename: string) =>
    this.getEntityByName(filename).locator(`~${FileSelectors.downloadIcon}`);

  public fileIcon = (name: string) =>
    this.getTreeEntity(name, { exactMatch: true }).locator(
      IconSelectors.fileIcon,
    );

  public getFolderByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      FolderSelectors.folderName,
    ).getElementLocatorByText(name, index);
  }

  public errorMessageContainer = this.getChildElementBySelector(
    ErrorLabelSelectors.errorContainer,
  );
}
