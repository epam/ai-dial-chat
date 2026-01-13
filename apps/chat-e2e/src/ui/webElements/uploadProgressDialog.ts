import { UploadProgressDialogSelectors } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Locator, Page } from '@playwright/test';

export class UploadProgressDialog extends Popup {
  constructor(page: Page) {
    super(page);
  }

  public title = this.getChildElementBySelector(
    UploadProgressDialogSelectors.title,
  );

  public fileItem = (fileName: string) =>
    this.rootLocator.locator(
      `${UploadProgressDialogSelectors.fileItem}:has-text("${fileName}")`,
    );

  public fileName = (fileName: string) =>
    this.fileItem(fileName).locator(UploadProgressDialogSelectors.fileName);

  public progressBar = (fileName: string) =>
    this.fileItem(fileName).locator(
      UploadProgressDialogSelectors.uploadingIndicator,
    );

  /**
   * Gets the file item row for a specific file
   */
  public getFileItem(fileName: string): Locator {
    return this.fileItem(fileName);
  }
}
