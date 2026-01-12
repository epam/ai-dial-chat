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
    this.fileItem(fileName).locator(UploadProgressDialogSelectors.progressBar);

  public progressBarContainer = (fileName: string) =>
    this.fileItem(fileName).locator(
      UploadProgressDialogSelectors.progressBarContainer,
    );

  /**
   * Gets the progress bar element for a specific file
   */
  public getFileProgressBar(fileName: string): Locator {
    return this.progressBar(fileName);
  }

  /**
   * Gets the progress bar container for checking visibility
   */
  public getFileProgressBarContainer(fileName: string): Locator {
    return this.progressBarContainer(fileName);
  }

  /**
   * Gets the file item row for a specific file
   */
  public getFileItem(fileName: string): Locator {
    return this.fileItem(fileName);
  }
}
