import { Publication } from '@/chat/types/publication';
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
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
      this.publishingApprovalModal.publishPathLabel,
      expectedState,
      ExpectedConstants.publishToLabel,
    );
  }

  public async assertPublishToPath(expectedPath: string) {
    await this.assertElementText(
      this.publishingApprovalModal.publishPath,
      expectedPath,
      PublishingExpectedMessages.publishToPathIsValid,
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

  public async assertReviewButtonTitle(expectedTitle: string) {
    await this.assertElementText(
      this.publishingApprovalModal.goToReviewButton,
      expectedTitle,
    );
  }

  public async assertGeneralInfo(fieldsToVerify: {
    requestName?: string;
    publishToLabel?: ElementState;
    unpublishFromLabel?: ElementState;
    publishPath?: string;
    authorLabel?: ElementState;
    author?: string;
    publicAuthorLabel?: ElementState;
    publicAuthor?: string;
    requestCreatedLabel?: ElementState;
    requestCreated?: Publication;
  }) {
    if (fieldsToVerify.requestName) {
      await this.assertElementText(
        this.publishingApprovalModal.publishName,
        fieldsToVerify.requestName,
      );
    }
    if (fieldsToVerify.publishToLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.publishPathLabel,
        fieldsToVerify.publishToLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.publishPathLabel,
        ExpectedConstants.publishToLabel,
      );
    }
    if (fieldsToVerify.unpublishFromLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.publishPathLabel,
        fieldsToVerify.unpublishFromLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.publishPathLabel,
        ExpectedConstants.unpublishFromLabel,
      );
    }
    if (fieldsToVerify.publishPath) {
      await this.assertElementText(
        this.publishingApprovalModal.publishPath,
        fieldsToVerify.publishPath,
      );
    }
    if (fieldsToVerify.authorLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.authorLabel,
        fieldsToVerify.authorLabel,
      );
      fieldsToVerify.authorLabel === 'visible'
        ? await this.assertElementText(
            this.publishingApprovalModal.authorLabel,
            ExpectedConstants.authorLabel,
          )
        : await this.assertElementState(
            this.publishingApprovalModal.authorLabel,
            'hidden',
          );
    }
    if (fieldsToVerify.author) {
      await this.assertElementText(
        this.publishingApprovalModal.author,
        fieldsToVerify.author,
      );
    }
    if (fieldsToVerify.publicAuthorLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.publicAuthorLabel,
        fieldsToVerify.publicAuthorLabel,
      );
      fieldsToVerify.publicAuthorLabel === 'visible'
        ? await this.assertElementText(
            this.publishingApprovalModal.publicAuthorLabel,
            ExpectedConstants.publicAuthorLabel,
          )
        : await this.assertElementState(
            this.publishingApprovalModal.publicAuthorLabel,
            'hidden',
          );
    }
    if (fieldsToVerify.publicAuthor) {
      await this.assertElementText(
        this.publishingApprovalModal.publicAuthor,
        fieldsToVerify.publicAuthor,
      );
    }
    if (fieldsToVerify.requestCreatedLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.requestCreatedLabel,
        fieldsToVerify.requestCreatedLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.requestCreatedLabel,
        ExpectedConstants.requestCreationDateLabel,
      );
    }
    if (fieldsToVerify.requestCreated) {
      await this.assertRequestCreationDate(fieldsToVerify.requestCreated);
    }
  }

  public async assertButtonsState(buttonsToVerify: {
    reviewButtonState?: ElementState;
    reviewButtonTitle?: string;
    rejectButtonState?: ElementActionabilityState;
    approveButtonState?: ElementActionabilityState;
    editButtonState?: ElementActionabilityState;
  }) {
    if (buttonsToVerify.reviewButtonState) {
      await this.assertElementState(
        this.publishingApprovalModal.goToReviewButton,
        buttonsToVerify.reviewButtonState,
      );
    }
    if (buttonsToVerify.reviewButtonTitle) {
      await this.assertReviewButtonTitle(buttonsToVerify.reviewButtonTitle);
    }
    if (buttonsToVerify.rejectButtonState) {
      await this.assertElementActionabilityState(
        this.publishingApprovalModal.rejectButton,
        buttonsToVerify.rejectButtonState,
      );
    }
    if (buttonsToVerify.approveButtonState) {
      await this.assertElementActionabilityState(
        this.publishingApprovalModal.approveButton,
        buttonsToVerify.approveButtonState,
      );
    }
    if (buttonsToVerify.editButtonState) {
      await this.assertElementActionabilityState(
        this.publishingApprovalModal.editButton,
        buttonsToVerify.editButtonState,
      );
    }
  }
}
