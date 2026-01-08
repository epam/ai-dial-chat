import { Tags } from '@/src/ui/domData';
import { UploadingItemsSelectors } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements';

export class UploadingItemsPopup extends Popup {
  public uploadingItemsCount = this.getChildElementBySelector(
    UploadingItemsSelectors.uploadingItemsCount,
  );
  public fileTypeIcon = this.content
    .getChildElementBySelector(UploadingItemsSelectors.fileTypeIcon)
    .getChildElementBySelector(Tags.svg);
  public uploadingItemName = this.content.getChildElementBySelector(
    UploadingItemsSelectors.itemName,
  );
  public uploadingIndicator = this.content.getChildElementBySelector(
    UploadingItemsSelectors.uploadingIndicator,
  );
}
