import { BaseAssertion } from '@/src/assertions';
import { BasePublishedReviewModal } from '@/src/ui/webElements';

export class BasePublishedEntityReviewModalAssertion<
  T extends BasePublishedReviewModal,
> extends BaseAssertion {
  readonly publishedEntityReviewModal: T;

  constructor(publishedEntityReviewModal: T) {
    super();
    this.publishedEntityReviewModal = publishedEntityReviewModal;
  }

  public async assertEntityAttributes(attributesToVerify: {
    expectedName?: string;
    expectedVersion?: string;
    expectedIcon?: string;
    expectedDescription?: string;
    expectedTopics?: string[];
  }) {
    if (attributesToVerify.expectedName) {
      await this.assertElementText(
        this.publishedEntityReviewModal.name,
        attributesToVerify.expectedName,
      );
    }
    if (attributesToVerify.expectedVersion) {
      await this.assertElementText(
        this.publishedEntityReviewModal.version,
        attributesToVerify.expectedVersion,
      );
    }
    if (attributesToVerify.expectedIcon) {
      await this.assertEntityIcon(
        this.publishedEntityReviewModal.getEntityIcon(),
        attributesToVerify.expectedIcon,
      );
    }
    if (attributesToVerify.expectedDescription) {
      await this.assertElementText(
        this.publishedEntityReviewModal.description,
        attributesToVerify.expectedDescription,
      );
    }
    if (attributesToVerify.expectedTopics) {
      await this.assertElementInnerText(
        this.publishedEntityReviewModal.topics,
        attributesToVerify.expectedTopics,
      );
    }
  }
}
