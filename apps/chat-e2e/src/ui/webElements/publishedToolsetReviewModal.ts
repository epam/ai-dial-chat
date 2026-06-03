import { ReviewEntityDialog } from '@/src/ui/selectors';
import { BasePublishedReviewModal } from '@/src/ui/webElements/basePublishedReviewModal';

export class PublishedToolsetReviewModal extends BasePublishedReviewModal {
  public endpoint = this.getChildElementBySelector(ReviewEntityDialog.endpoint);
  public transportProtocol = this.getChildElementBySelector(
    ReviewEntityDialog.transport,
  );
  public authType = this.getChildElementBySelector(ReviewEntityDialog.authType);
  public allowedTools = this.getChildElementBySelector(
    ReviewEntityDialog.allowedTools,
  );
}
