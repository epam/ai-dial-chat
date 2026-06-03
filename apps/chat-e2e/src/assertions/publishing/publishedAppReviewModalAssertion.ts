import { BasePublishedEntityReviewModalAssertion } from '@/src/assertions';
import { PublishingExpectedMessages } from '@/src/testData';
import { AttributeValues, Attributes } from '@/src/ui/domData';
import { PublishedApplicationReviewModal } from '@/src/ui/webElements/publishedApplicationReviewModal';

export class PublishedAppReviewModalAssertion extends BasePublishedEntityReviewModalAssertion<PublishedApplicationReviewModal> {
  constructor(publishedEntityReviewModal: PublishedApplicationReviewModal) {
    super(publishedEntityReviewModal);
  }

  public async assertAppFeaturesData(expectedFeatures: Record<string, string>) {
    await this.assertElementInnerText(
      this.publishedEntityReviewModal.featuresData,
      Object.entries(expectedFeatures).map(([k, v]) => `"${k}" : "${v}"`),
      PublishingExpectedMessages.publicationFeaturesDataIsValid,
    );
  }

  public async assertAppAttributes(attributesToVerify: {
    expectedName?: string;
    expectedVersion?: string;
    expectedIcon?: string;
    expectedDescription?: string;
    expectedTopics?: string[];
    expectedFeatures?: Record<string, string>;
    expectedAttachmentTypes?: string[];
    expectedMaxAttachmentNumbers?: number;
    expectedCompletionUrl?: string;
    expectedExternalUrl?: string;
  }) {
    await this.assertEntityAttributes(attributesToVerify);
    if (attributesToVerify.expectedFeatures) {
      await this.assertAppFeaturesData(attributesToVerify.expectedFeatures);
    }
    if (attributesToVerify.expectedAttachmentTypes) {
      await this.assertElementInnerText(
        this.publishedEntityReviewModal.attachmentTypes,
        attributesToVerify.expectedAttachmentTypes,
      );
    }
    if (attributesToVerify.expectedMaxAttachmentNumbers) {
      await this.assertElementText(
        this.publishedEntityReviewModal.maxAttachmentsNumber,
        attributesToVerify.expectedMaxAttachmentNumbers,
      );
    }
    if (attributesToVerify.expectedCompletionUrl) {
      await this.assertElementState(
        this.publishedEntityReviewModal.completionUrlLabel,
        'visible',
      );
      await this.assertElementText(
        this.publishedEntityReviewModal.completionUrl,
        attributesToVerify.expectedCompletionUrl,
      );
    }
    if (attributesToVerify.expectedExternalUrl) {
      await this.assertElementState(
        this.publishedEntityReviewModal.externalUrlLabel,
        'visible',
      );
      await this.assertElementAttribute(
        this.publishedEntityReviewModal.externalUrl,
        Attributes.href,
        attributesToVerify.expectedExternalUrl,
      );
      await this.assertElementAttribute(
        this.publishedEntityReviewModal.externalUrl,
        Attributes.target,
        AttributeValues.blank,
      );
      await this.assertElementState(
        this.publishedEntityReviewModal.externalUrlIcon,
        'visible',
      );
    }
  }
}
