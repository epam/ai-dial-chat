import { BaseAssertion } from '@/src/assertions';
import { PublishingExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { PublishedApplicationReviewModal } from '@/src/ui/webElements/publishedApplicationReviewModal';

export class PublishedAppReviewModalAssertion extends BaseAssertion {
  readonly publishedApplicationReviewModal: PublishedApplicationReviewModal;

  constructor(
    publishedApplicationReviewModal: PublishedApplicationReviewModal,
  ) {
    super();
    this.publishedApplicationReviewModal = publishedApplicationReviewModal;
  }

  public async assertAppFeaturesData(expectedFeatures: Record<string, string>) {
    await this.assertElementInnerText(
      this.publishedApplicationReviewModal.featuresData,
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
    if (attributesToVerify.expectedName) {
      await this.assertElementText(
        this.publishedApplicationReviewModal.name,
        attributesToVerify.expectedName,
      );
    }
    if (attributesToVerify.expectedVersion) {
      await this.assertElementText(
        this.publishedApplicationReviewModal.version,
        attributesToVerify.expectedVersion,
      );
    }
    if (attributesToVerify.expectedIcon) {
      await this.assertEntityIcon(
        this.publishedApplicationReviewModal.getApplicationIcon(),
        attributesToVerify.expectedIcon,
      );
    }
    if (attributesToVerify.expectedDescription) {
      await this.assertElementText(
        this.publishedApplicationReviewModal.description,
        attributesToVerify.expectedDescription,
      );
    }
    if (attributesToVerify.expectedTopics) {
      await this.assertElementInnerText(
        this.publishedApplicationReviewModal.topics,
        attributesToVerify.expectedTopics,
      );
    }
    if (attributesToVerify.expectedFeatures) {
      await this.assertAppFeaturesData(attributesToVerify.expectedFeatures);
    }
    if (attributesToVerify.expectedAttachmentTypes) {
      await this.assertElementInnerText(
        this.publishedApplicationReviewModal.attachmentTypes,
        attributesToVerify.expectedAttachmentTypes,
      );
    }
    if (attributesToVerify.expectedMaxAttachmentNumbers) {
      await this.assertElementText(
        this.publishedApplicationReviewModal.maxAttachmentsNumber,
        attributesToVerify.expectedMaxAttachmentNumbers,
      );
    }
    if (attributesToVerify.expectedCompletionUrl) {
      await this.assertElementState(
        this.publishedApplicationReviewModal.completionUrlLabel,
        'visible',
      );
      await this.assertElementText(
        this.publishedApplicationReviewModal.completionUrl,
        attributesToVerify.expectedCompletionUrl,
      );
    }
    if (attributesToVerify.expectedExternalUrl) {
      await this.assertElementState(
        this.publishedApplicationReviewModal.externalUrlLabel,
        'visible',
      );
      await this.assertElementAttribute(
        this.publishedApplicationReviewModal.externalUrl,
        Attributes.href,
        attributesToVerify.expectedExternalUrl,
      );
      await this.assertElementAttribute(
        this.publishedApplicationReviewModal.externalUrl,
        Attributes.target,
        Attributes.blank,
      );
      await this.assertElementState(
        this.publishedApplicationReviewModal.externalUrlIcon,
        'visible',
      );
    }
  }
}
