import { PromptPreviewModalWindow } from '@/src/ui/webElements/promptPreviewModalWindow';
import { PublicationReviewControl } from '@/src/ui/webElements/publicationReviewControl';
import { Page } from 'playwright-chromium';

export class PublishedPromptPreviewModal extends PromptPreviewModalWindow {
  constructor(page: Page) {
    super(page);
    this.publicationReviewControl = new PublicationReviewControl(
      this.page,
      this.rootLocator,
    );
  }

  private readonly publicationReviewControl: PublicationReviewControl;

  getPublicationReviewControl(): PublicationReviewControl {
    return this.publicationReviewControl;
  }
}
