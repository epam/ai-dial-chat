import { ReviewEntityDialog } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements/common/popup';
import { PublicationReviewControl } from '@/src/ui/webElements/publicationReviewControl';
import { Locator } from '@playwright/test';
import { Page } from 'playwright-chromium';

export class BasePublishedReviewModal extends Popup {
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

  public getEntityIcon(): Locator {
    return this.getElementIcon(this.rootLocator);
  }
  public name = this.getChildElementBySelector(ReviewEntityDialog.name);
  public version = this.getChildElementBySelector(ReviewEntityDialog.version);
  public description = this.getChildElementBySelector(
    ReviewEntityDialog.description,
  );
  public topics = this.getChildElementBySelector(ReviewEntityDialog.topics);
}
