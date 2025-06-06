import { ReviewApplicationDialog } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { PublicationReviewControl } from '@/src/ui/webElements/publicationReviewControl';
import { Locator } from '@playwright/test';
import { Page } from 'playwright-chromium';

export class PublishedApplicationReviewModal extends BaseElement {
  constructor(page: Page) {
    super(page, ReviewApplicationDialog.reviewDialog);
    this.publicationReviewControl = new PublicationReviewControl(
      this.page,
      this.rootLocator,
    );
  }

  private readonly publicationReviewControl: PublicationReviewControl;

  getPublicationReviewControl(): PublicationReviewControl {
    return this.publicationReviewControl;
  }

  public getApplicationIcon(): Locator {
    return this.getElementIcon(this.rootLocator);
  }
}
