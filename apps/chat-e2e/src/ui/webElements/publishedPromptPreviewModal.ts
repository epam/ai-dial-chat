import { PublicationReviewControls } from '@/src/ui/selectors';
import { promptPreviewModal } from '@/src/ui/webElements/promptPreviewModal';

export class PublishedPromptPreviewModal extends promptPreviewModal {
  public reviewContainer = this.getChildElementBySelector(
    PublicationReviewControls.reviewContainer,
  );
  public previousButton = this.reviewContainer.getChildElementBySelector(
    PublicationReviewControls.previousButton,
  );
  public nextButton = this.reviewContainer.getChildElementBySelector(
    PublicationReviewControls.nextButton,
  );
  public backToPublicationButton =
    this.reviewContainer.getChildElementBySelector(
      PublicationReviewControls.backToPublication,
    );
}
