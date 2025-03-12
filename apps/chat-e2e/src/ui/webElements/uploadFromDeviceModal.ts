import { BaseElement } from './baseElement';

import { Attachment, ExpectedConstants } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
import {
  FileSelectors,
  IconSelectors,
  UploadFromDeviceModalSelectors,
} from '@/src/ui/selectors';
import { ChangePath } from '@/src/ui/webElements/changePath';
import { FilesModalHeader } from '@/src/ui/webElements/filesModalHeader';
import { ModalError } from '@/src/ui/webElements/modalError';
import { Page } from '@playwright/test';

export class UploadFromDeviceModal extends BaseElement {
  constructor(page: Page) {
    super(page, UploadFromDeviceModalSelectors.modalContainer);
  }

  private modalHeader!: FilesModalHeader;
  private changeUploadToPath!: ChangePath;
  public modalError!: ModalError;

  getModalHeader(): FilesModalHeader {
    if (!this.modalHeader) {
      this.modalHeader = new FilesModalHeader(this.page, this.rootLocator);
    }
    return this.modalHeader;
  }

  getChangeUploadToPath(): ChangePath {
    if (!this.changeUploadToPath) {
      this.changeUploadToPath = new ChangePath(this.page, this.rootLocator);
    }
    return this.changeUploadToPath;
  }

  getModalError(): ModalError {
    if (!this.modalError) {
      this.modalError = new ModalError(this.page, this.rootLocator);
    }
    return this.modalError;
  }

  public uploadedFiles = this.getChildElementBySelector(
    UploadFromDeviceModalSelectors.uploadedFiles,
  );

  public uploadButton = this.getChildElementBySelector(
    UploadFromDeviceModalSelectors.uploadButton,
  );

  public addMoreFiles = this.getChildElementBySelector(
    UploadFromDeviceModalSelectors.addMoreFiles,
  ).getChildElementBySelector(FileSelectors.fileTypeAttribute);

  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public async changeUploadToLocation() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.request().method() === 'GET',
    );
    await this.getChangeUploadToPath().changeButton.click();
    await responsePromise;
  }

  public getUploadedFile = (filename: string) => {
    const dotIndex = filename.lastIndexOf('.');
    let filenameValue =
      dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
    ExpectedConstants.charsToEscape.forEach((char) => {
      if (filename.includes(char)) {
        filenameValue = filenameValue.replaceAll(char, `\\${char}`);
      }
    });
    const inputValue = new BaseElement(
      this.page,
      `[${Attributes.value} = "${filenameValue}"]`,
    ).getElementLocator();
    return this.uploadedFiles
      .getChildElementBySelector(UploadFromDeviceModalSelectors.uploadedFile)
      .getElementLocator()
      .filter({ has: inputValue });
  };

  public getUploadedFilenameInputLocator(filename: string) {
    return this.getUploadedFile(filename).locator(Tags.input);
  }

  public getUploadedFilenameInput(filename: string) {
    return this.createElementFromLocator(
      this.getUploadedFilenameInputLocator(filename),
    );
  }

  public getUploadedFileExtension(filename: string) {
    return this.createElementFromLocator(
      this.getUploadedFile(filename).locator(
        UploadFromDeviceModalSelectors.fileExtension,
      ),
    );
  }

  public getDeleteUploadedFileIcon(filename: string) {
    return this.createElementFromLocator(
      this.getUploadedFile(filename).locator(
        UploadFromDeviceModalSelectors.deleteUploadedFileIcon,
      ),
    );
  }

  public async setUploadedFilename(
    currentFilename: string,
    newFilename: string,
  ) {
    await this.getUploadedFilenameInputLocator(currentFilename).fill(
      newFilename,
    );
  }

  public async typeInUploadedFilename(currentFilename: string, text: string) {
    await this.getUploadedFilenameInputLocator(
      currentFilename,
    ).pressSequentially(text);
  }

  public async uploadFiles() {
    const respPremise = this.page.waitForResponse(
      (r) => r.request().method() === 'POST',
    );
    await this.uploadButton.click();
    await respPremise;
  }

  public async addMoreFilesToUpload(...filenames: string[]) {
    await this.addMoreFiles.setElementInputFiles(
      Attachment.attachmentPath,
      ...filenames,
    );
  }
}
