import { Tags } from '@/src/ui/domData';
import {
  AttachFilesModalSelectors,
  EntitySelectors,
  ErrorLabelSelectors,
  FileSelectors,
} from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class AttachFiles extends EntitiesTree {
  constructor(page: Page, parentLocator: Locator, filesSection: string) {
    super(page, parentLocator, filesSection, EntitySelectors.file);
  }

  public attachedFileIcon = (filename: string) =>
    this.getEntityByName(filename).locator(
      AttachFilesModalSelectors.attachedFileIcon,
    );

  public attachedFileLoadingIndicator = (filename: string) =>
    this.getEntityByName(filename).locator(FileSelectors.loadingIndicator);

  public removeAttachedFileIcon = (filename: string) =>
    this.createElementFromLocator(
      this.getEntityByName(filename).locator(FileSelectors.remove),
    );

  public attachedFileErrorIcon = (filename: string) =>
    this.getEntityByName(filename).locator(
      `${Tags.svg}${ErrorLabelSelectors.fieldError}`,
    );

  public attachedFileLoadingRetry = (filename: string) =>
    this.getEntityByName(filename).locator(FileSelectors.loadingRetry);
}
