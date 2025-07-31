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
  public name = this.getChildElementBySelector(ReviewApplicationDialog.name);
  public version = this.getChildElementBySelector(
    ReviewApplicationDialog.version,
  );
  public description = this.getChildElementBySelector(
    ReviewApplicationDialog.description,
  );
  public topics = this.getChildElementBySelector(
    ReviewApplicationDialog.topics,
  );
  public featuresData = this.getChildElementBySelector(
    ReviewApplicationDialog.featuresData,
  );
  public attachmentTypes = this.getChildElementBySelector(
    ReviewApplicationDialog.attachmentTypes,
  );
  public maxAttachmentsNumber = this.getChildElementBySelector(
    ReviewApplicationDialog.maxAttachmentsNumber,
  );
  public completionUrl = this.getChildElementBySelector(
    ReviewApplicationDialog.completionUrl,
  );
}
