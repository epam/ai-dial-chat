import { PromptPreviewModalWindow } from '@/src/ui/webElements/promptPreviewModalWindow';
import { PublicationReviewControl } from '@/src/ui/webElements/publicationReviewControl';
import { Page } from 'playwright-chromium';

export class PublishedPromptPreviewModal extends PromptPreviewModalWindow {
  private publicationReviewControl: PublicationReviewControl;
  constructor(page: Page) {
    super(page);
    this.publicationReviewControl = new PublicationReviewControl(
      page,
      this.getElementLocator(),
    );
  }
  getPublicationReviewControl(): PublicationReviewControl {
    if (!this.publicationReviewControl) {
      this.publicationReviewControl = new PublicationReviewControl(
        this.page,
        this.rootLocator,
      );
    }
    return this.publicationReviewControl;
  }
}
