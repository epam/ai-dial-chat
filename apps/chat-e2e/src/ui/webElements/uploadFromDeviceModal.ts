import { BaseElement } from './baseElement';

import { Attributes, Tags } from '@/src/ui/domData';
import { UploadFromDeviceModalSelectors } from '@/src/ui/selectors';
import { Page } from '@playwright/test';

export class UploadFromDeviceModal extends BaseElement {
  constructor(page: Page) {
    super(page, UploadFromDeviceModalSelectors.modalContainer);
  }

  public uploadButton = this.getChildElementBySelector(
    UploadFromDeviceModalSelectors.uploadButton,
  );

  public getUploadedFile = (filename: string) => {
    const dotIndex = filename.indexOf('.');
    const inputValue = new BaseElement(
      this.page,
      `[${Attributes.value} = "${filename.substring(0, dotIndex)}"]`,
    ).getElementLocator();
    return this.getChildElementBySelector(
      UploadFromDeviceModalSelectors.uploadedFile,
    )
      .getElementLocator()
      .filter({ has: inputValue });
  };

  public async setUploadedFilename(
    currentFilename: string,
    newFilename: string,
  ) {
    await this.getUploadedFile(currentFilename)
      .locator(Tags.input)
      .fill(newFilename);
  }

  public async uploadFile() {
    const respPremise = this.page.waitForResponse(
      (r) => r.request().method() === 'POST',
    );
    await this.uploadButton.click();
    await respPremise;
  }
}
