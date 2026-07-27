import { DownloadTableCsvModalSelectors } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Page } from '@playwright/test';

export class DownloadTableCsvModal extends Popup {
  constructor(page: Page) {
    super(page, DownloadTableCsvModalSelectors.modalContainer);
  }

  public title = this.getChildElementBySelector(
    DownloadTableCsvModalSelectors.title,
  );
  public filenameInput = this.getChildElementBySelector(
    DownloadTableCsvModalSelectors.filenameInput,
  );
  public confirmButton = this.getChildElementBySelector(
    DownloadTableCsvModalSelectors.confirmButton,
  );

  public async getFilename() {
    return this.filenameInput.getAttribute('value');
  }
}
