import { BaseElement } from './baseElement';

import { UploadFromDeviceModalSelectors } from '@/src/ui/selectors';
import { Page } from '@playwright/test';

export class UploadFromDeviceModal extends BaseElement {
  constructor(page: Page) {
    super(page, UploadFromDeviceModalSelectors.modalContainer);
  }

  public uploadButton = this.getChildElementBySelector(
    UploadFromDeviceModalSelectors.uploadButton,
  );

  public async uploadFile() {
    const respPromise = this.page.waitForResponse(
      (resp) => resp.request().method() === 'POST',
    );
    await this.uploadButton.click();
    await respPromise;
    await this.waitForState({ state: 'hidden' });
  }
}
