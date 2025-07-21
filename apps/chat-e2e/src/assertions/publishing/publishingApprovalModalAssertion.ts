import { Publication } from '@/chat/types/publication';
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementState,
  ExpectedConstants,
  PublishingExpectedMessages,
} from '@/src/testData';
import { PublishingApprovalModal } from '@/src/ui/webElements';
import { DateUtil } from '@/src/utils';

export class PublishingApprovalModalAssertion extends BaseAssertion {
  readonly publishingApprovalModal: PublishingApprovalModal;

  constructor(publishingApprovalModal: PublishingApprovalModal) {
    super();
    this.publishingApprovalModal = publishingApprovalModal;
  }

  public async assertPublishToLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.publishToPathLabel,
      expectedState,
      ExpectedConstants.publishToLabel,
    );
  }

  public async assertPublishToPath(expectedPath: string) {
    await this.assertElementText(
      this.publishingApprovalModal.publishToPath,
      expectedPath,
      PublishingExpectedMessages.publishToPathIsValid,
    );
  }

  public async assertAuthorLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.authorLabel,
      expectedState,
      PublishingExpectedMessages.publishAuthorIsValid,
    );
  }

  public async assertPublicAuthorLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.publicAuthorLabel,
      expectedState,
      PublishingExpectedMessages.publishAuthorPublicNameIsValid,
    );
  }

  public async assertRequestCreationDate(publicationRequest: Publication) {
    await this.assertElementText(
      this.publishingApprovalModal.creationDate,
      DateUtil.convertUnixTimestampToLocalDate(publicationRequest.createdAt),
      PublishingExpectedMessages.publishCreationDateIsValid,
    );
  }

  public async assertRequestCreatedLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.requestCreatedLabel,
      expectedState,
      ExpectedConstants.requestCreationDateLabel,
    );
  }

  public async assertAllowAccessLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.allowAccessLabel,
      expectedState,
      ExpectedConstants.allowAccessLabel,
    );
  }

  public async assertNoChangesLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.noChangesLabel,
      expectedState,
      ExpectedConstants.noChangesLabel,
    );
  }

  public async assertAvailabilityLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.availabilityLabel,
      expectedState,
      ExpectedConstants.availabilityLabel,
    );
  }

  public async assertReviewButtonTitle(expectedTitle: string) {
    await this.assertElementText(
      this.publishingApprovalModal.goToReviewButton,
      expectedTitle,
    );
  }
}
