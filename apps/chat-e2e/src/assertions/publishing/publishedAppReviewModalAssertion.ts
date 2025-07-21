import { BaseAssertion } from '@/src/assertions';
import { PublishingExpectedMessages } from '@/src/testData';
import { PublishedApplicationReviewModal } from '@/src/ui/webElements/publishedApplicationReviewModal';

export class PublishedAppReviewModalAssertion extends BaseAssertion {
  readonly publishedApplicationReviewModal: PublishedApplicationReviewModal;

  constructor(
    PublishedApplicationReviewModal: PublishedApplicationReviewModal,
  ) {
    super();
    this.publishedApplicationReviewModal = PublishedApplicationReviewModal;
  }

  public async assertAppFeaturesData(expectedFeatures: Record<string, string>) {
    await this.assertElementInnerText(
      this.publishedApplicationReviewModal.featuresData,
      Object.entries(expectedFeatures).map(([k, v]) => `"${k}" : "${v}"`),
      PublishingExpectedMessages.publicationFeaturesDataIsValid,
    );
  }
}
