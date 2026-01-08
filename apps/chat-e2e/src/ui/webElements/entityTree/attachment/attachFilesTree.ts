import { AttributeValues, Tags } from '@/src/ui/domData';
import {
  EntitySelectors,
  ErrorLabelSelectors,
  FileSelectors,
  FilesManagerModalSelectors,
} from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class AttachFilesTree extends EntitiesTree {
  constructor(page: Page, parentLocator: Locator, filesSection: string) {
    super(page, parentLocator, filesSection, EntitySelectors.file);
  }

  public attachedFileIcon = (filename: string, index?: number) =>
    this.getEntityByName(filename, index).locator(
      FilesManagerModalSelectors.attachedFileIcon,
    );

  getAttachedFileArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index)
      .locator(FilesManagerModalSelectors.arrowAdditionalIcon)
      .locator(Tags.svg);
  }

  public attachedFileLoadingIndicator = (filename: string) =>
    this.getEntityByName(filename).locator(FileSelectors.loadingIndicator);

  public removeAttachedFileIcon = (filename: string) =>
    new Button(
      this.page,
      AttributeValues.removeFile,
      this.getEntityByName(filename),
    );

  public attachedFileErrorIcon = (filename: string) =>
    this.getEntityByName(filename).locator(
      `${Tags.svg}${ErrorLabelSelectors.fieldError}`,
    );

  public attachedFileLoadingRetry = (filename: string) =>
    this.getEntityByName(filename).locator(FileSelectors.loadingRetry);
}
