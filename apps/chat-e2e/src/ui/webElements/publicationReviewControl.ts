import { API } from '@/src/testData';
import { PublicationReviewControls } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class PublicationReviewControl extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PublicationReviewControls.reviewContainer, parentLocator);
  }

  public previousButton = this.getChildElementBySelector(
    PublicationReviewControls.previousButton,
  );
  public nextButton = this.getChildElementBySelector(
    PublicationReviewControls.nextButton,
  );
  public backToPublicationRequestButton = this.getChildElementBySelector(
    PublicationReviewControls.backToPublication,
  );

  public async backToPublicationRequest() {
    const responsePromise = this.page.waitForResponse((r) =>
      r.request().url().includes(API.publicationRequestDetails),
    );
    await this.backToPublicationRequestButton.click();
    await responsePromise;
  }

  public async goNext() {
    const responsePromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET',
    );
    await this.nextButton.click();
    await responsePromise;
  }

  public async goBack({
    isHttpMethodTriggered = true,
  }: { isHttpMethodTriggered?: boolean } = {}) {
    if (isHttpMethodTriggered) {
      const responsePromise = this.page.waitForResponse(
        (r) => r.request().method() === 'GET',
      );
      await this.previousButton.click();
      await responsePromise;
    } else {
      await this.previousButton.click();
    }
  }
}
