import { Styles, Tags } from '@/src/ui/domData';
import {
  AttachFilesModalSelectors,
  EntitySelectors,
  ErrorLabelSelectors,
  FileSelectors,
  SideBarSelectors,
} from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class AttachFilesTree extends EntitiesTree {
  constructor(page: Page, parentLocator: Locator, filesSection: string) {
    super(page, parentLocator, filesSection, EntitySelectors.file);
  }

  public attachedFileIcon = (filename: string) =>
    this.getEntityByName(filename).locator(
      AttachFilesModalSelectors.attachedFileIcon,
    );

  getAttachedFileArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      AttachFilesModalSelectors.arrowAdditionalIcon,
    );
  }

  getAttachedFileArrowIconColor(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getAttachedFileArrowIcon(name, index).locator(Tags.svg),
    ).getComputedStyleProperty(Styles.color);
  }

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
