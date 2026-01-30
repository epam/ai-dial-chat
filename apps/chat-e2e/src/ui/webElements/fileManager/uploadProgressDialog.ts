import { Tags } from '@/src/ui/domData';
import { UploadProgressDialogSelectors } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Page } from '@playwright/test';

export class UploadProgressDialog extends Popup {
  constructor(page: Page) {
    super(page);
  }

  public title = this.getChildElementBySelector(
    UploadProgressDialogSelectors.title,
  );

  /**
   * Counter showing upload progress (e.g., "0 of 3 items uploaded...")
   */
  public uploadingItemsCount = this.getChildElementBySelector(
    UploadProgressDialogSelectors.uploadingItemsCount,
  );

  /**
   * Generic file type icon element - useful for counting items in the popup
   * when filenames are unknown or for verifying icon presence
   */
  public fileTypeIcon = this.content
    .getChildElementBySelector(UploadProgressDialogSelectors.fileTypeIcon)
    .getChildElementBySelector(Tags.svg);

  /**
   * Generic uploading item name element - useful for counting items in the popup
   * when filenames are unknown
   */
  public uploadingItemName = this.content.getChildElementBySelector(
    UploadProgressDialogSelectors.itemName,
  );

  /**
   * Generic uploading indicator (progress bar) - useful for checking upload progress state
   */
  public uploadingIndicator = this.content.getChildElementBySelector(
    UploadProgressDialogSelectors.uploadingIndicator,
  );
}
