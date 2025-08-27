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

  public async assertGeneralInfo(fieldsToVerify: {
    requestName?: string;
    publishToLabel?: ElementState;
    publishTo?: string;
    authorLabel?: ElementState;
    author?: string;
    publicAuthorLabel?: ElementState;
    publicAuthor?: string;
    requestCreatedLabel?: ElementState;
    requestCreated?: Publication;
    allowAccessLabel?: ElementState;
    availabilityLabel?: ElementState;
    noChangesLabel?: ElementState;
  }) {
    if (fieldsToVerify.requestName) {
      await this.assertElementText(
        this.publishingApprovalModal.publishName,
        fieldsToVerify.requestName,
      );
    }
    if (fieldsToVerify.publishToLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.publishToPathLabel,
        fieldsToVerify.publishToLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.publishToPathLabel,
        ExpectedConstants.publishToLabel,
      );
    }
    if (fieldsToVerify.publishTo) {
      await this.assertElementText(
        this.publishingApprovalModal.publishToPath,
        fieldsToVerify.publishTo,
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
    if (fieldsToVerify.allowAccessLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.allowAccessLabel,
        fieldsToVerify.allowAccessLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.allowAccessLabel,
        ExpectedConstants.allowAccessLabel,
      );
    }
    if (fieldsToVerify.availabilityLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.availabilityLabel,
        fieldsToVerify.availabilityLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.availabilityLabel,
        ExpectedConstants.availabilityLabel,
      );
    }
    if (fieldsToVerify.noChangesLabel) {
      await this.assertElementState(
        this.publishingApprovalModal.noChangesLabel,
        fieldsToVerify.noChangesLabel,
      );
      await this.assertElementText(
        this.publishingApprovalModal.noChangesLabel,
        ExpectedConstants.noChangesLabel,
      );
    }
  }

  public async assertButtonsState(buttonsToVerify: {
    reviewButtonState?: ElementState;
    reviewButtonTitle?: string;
    rejectButtonState?: ElementActionabilityState;
    approveButtonState?: ElementActionabilityState;
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
  }
}
