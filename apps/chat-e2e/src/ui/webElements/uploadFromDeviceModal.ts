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
}
