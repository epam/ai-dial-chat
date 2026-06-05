import { AUTH_TYPE_OPTIONS } from '@/chat/constants/toolsets';
import { BasePublishedEntityReviewModalAssertion } from '@/src/assertions';
import { PublishedToolsetReviewModal } from '@/src/ui/webElements';
import { ToolsetAuthTypes, ToolsetTransportType } from '@epam/ai-dial-shared';

export class PublishedToolsetReviewModalAssertion extends BasePublishedEntityReviewModalAssertion<PublishedToolsetReviewModal> {
  constructor(publishedEntityReviewModal: PublishedToolsetReviewModal) {
    super(publishedEntityReviewModal);
  }

  public async assertToolsetAttributes(attributesToVerify: {
    expectedName?: string;
    expectedVersion?: string;
    expectedIcon?: string;
    expectedDescription?: string;
    expectedTopics?: string[];
    expectedEndpoint?: string;
    expectedTransportProtocol?: ToolsetTransportType;
    expectedAuthenticationType?: ToolsetAuthTypes;
    expectedAllowedTools?: string[];
  }) {
    await this.assertEntityAttributes(attributesToVerify);
    if (attributesToVerify.expectedEndpoint) {
      await this.assertElementText(
        this.publishedEntityReviewModal.endpoint,
        attributesToVerify.expectedEndpoint,
      );
    }
    if (attributesToVerify.expectedTransportProtocol) {
      await this.assertElementText(
        this.publishedEntityReviewModal.transportProtocol,
        attributesToVerify.expectedTransportProtocol,
      );
    }
    if (attributesToVerify.expectedAuthenticationType) {
      await this.assertElementText(
        this.publishedEntityReviewModal.authType,
        AUTH_TYPE_OPTIONS[attributesToVerify.expectedAuthenticationType].name,
      );
    }
    if (attributesToVerify.expectedAllowedTools) {
      await this.assertElementInnerText(
        this.publishedEntityReviewModal.allowedTools,
        attributesToVerify.expectedAllowedTools,
      );
    }
  }
}
