import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import {
  AttachFilesModalSelectors,
  ErrorLabelSelectors,
  SideBarSelectors,
} from '@/src/ui/selectors';
import { FileSelectors } from '@/src/ui/selectors/fileSelectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { FilesModalHeader } from '@/src/ui/webElements/filesModalHeader';
import { Page } from '@playwright/test';

export class AttachFilesModal extends BaseElement {
  constructor(page: Page) {
    super(page, AttachFilesModalSelectors.modalContainer);
  }

  private fileDropdownMenu!: DropdownMenu;
  private modalHeader!: FilesModalHeader;

  getFileDropdownMenu(): DropdownMenu {
    if (!this.fileDropdownMenu) {
      this.fileDropdownMenu = new DropdownMenu(this.page);
    }
    return this.fileDropdownMenu;
  }

  getModalHeader(): FilesModalHeader {
    if (!this.modalHeader) {
      this.modalHeader = new FilesModalHeader(this.page, this.rootLocator);
    }
    return this.modalHeader;
  }

  public attachedFile = (filename: string) =>
    this.getChildElementBySelector(
      AttachFilesModalSelectors.attachedFile,
    ).getElementLocatorByText(filename);

  public attachedFileIcon = (filename: string) =>
    this.attachedFile(filename).locator(
      AttachFilesModalSelectors.attachedFileIcon,
    );

  public attachedFileName = (filename: string) =>
    this.createElementFromLocator(
      this.attachedFile(filename).locator(
        AttachFilesModalSelectors.attachedFileName,
      ),
    );

  public attachedFileCheckBox = (filename: string) =>
    this.attachedFileIcon(filename).getByRole('checkbox');

  public attachedFileLoadingIndicator = (filename: string) =>
    this.attachedFile(filename).locator(FileSelectors.loadingIndicator);

  public removeAttachedFileIcon = (filename: string) =>
    this.createElementFromLocator(
      this.attachedFile(filename).locator(FileSelectors.remove),
    );

  public attachedFileErrorIcon = (filename: string) =>
    this.attachedFile(filename).locator(
      `${Tags.svg}${ErrorLabelSelectors.fieldError}`,
    );

  public attachedFileLoadingRetry = (filename: string) =>
    this.attachedFile(filename).locator(FileSelectors.loadingRetry);

  public attachFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.attachFilesButton,
  );

  public uploadFromDeviceButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.uploadFromDeviceButton,
  );

  public deleteFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.deleteFilesButton,
  );

  public downloadFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.downloadFilesButton,
  );

  public async checkAttachedFile(filename: string) {
    await this.attachedFileIcon(filename).click();
  }

  public async attachFiles() {
    await this.attachFilesButton.click();
    await this.waitForState({ state: 'hidden' });
  }

  public async openFileDropdownMenu(filename: string) {
    const file = this.attachedFile(filename);
    await file.hover();
    await file.locator(SideBarSelectors.dotsMenu).click();
    await this.getFileDropdownMenu().waitForState();
  }

  public async getAttachedFileErrorMessage() {
    return this.getChildElementBySelector(
      ErrorLabelSelectors.fieldError,
    ).getElementContent();
  }
}
