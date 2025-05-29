import { Tags } from '@/src/ui/domData';
import { ReviewApplicationDialog } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { PublicationReviewControl } from '@/src/ui/webElements/publicationReviewControl';
import { Page } from 'playwright-chromium';

export class PublishedApplicationPreviewModal extends BaseElement {
  constructor(page: Page) {
    super(page, ReviewApplicationDialog.reviewDialog);
  }

  private publicationReviewControl: PublicationReviewControl | undefined;

  getPublicationReviewControl(): PublicationReviewControl {
    if (!this.publicationReviewControl) {
      this.publicationReviewControl = new PublicationReviewControl(
        this.page,
        this.rootLocator,
      );
    }
    return this.publicationReviewControl;
  }

  public getApplicationIcon(): BaseElement {
    return this.getChildElementBySelector(
      ReviewApplicationDialog.entityIcon,
    ).getChildElementBySelector(Tags.img);
  }
}
