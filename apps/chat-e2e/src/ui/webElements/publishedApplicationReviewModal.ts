import { IconSelectors, ReviewEntityDialog } from '@/src/ui/selectors';
import { BasePublishedReviewModal } from '@/src/ui/webElements/basePublishedReviewModal';

export class PublishedApplicationReviewModal extends BasePublishedReviewModal {
  // Opens the app in the editor with the publication under review.
  public editApplicationButton = this.getChildElementBySelector(
    ReviewEntityDialog.editApplicationButton,
  );
  public featuresData = this.getChildElementBySelector(
    ReviewEntityDialog.featuresData,
  );
  public attachmentTypes = this.getChildElementBySelector(
    ReviewEntityDialog.attachmentTypes,
  );
  public maxAttachmentsNumber = this.getChildElementBySelector(
    ReviewEntityDialog.maxAttachmentsNumber,
  );
  public completionUrlLabel = this.getChildElementBySelector(
    ReviewEntityDialog.completionUrlLabel,
  );
  public completionUrl = this.getChildElementBySelector(
    ReviewEntityDialog.completionUrl,
  );
  public externalUrlLabel = this.getChildElementBySelector(
    ReviewEntityDialog.externalUrlLabel,
  );
  public externalUrl = this.getChildElementBySelector(
    ReviewEntityDialog.externalUrl,
  );
  public externalUrlIcon = this.externalUrl.getChildElementBySelector(
    IconSelectors.externalAppIcon,
  );
}
