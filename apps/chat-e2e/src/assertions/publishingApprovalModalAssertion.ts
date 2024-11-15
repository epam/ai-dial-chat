import { Publication } from '@/chat/types/publication';
import { BaseAssertion } from '@/src/assertions/baseAssertion';
import {
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
  PublishingExpectedMessages,
} from '@/src/testData';
import { PublishingApprovalModal } from '@/src/ui/webElements';
import { DateUtil } from '@/src/utils';
import { expect } from '@playwright/test';

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
    expect
      .soft(
        await this.publishingApprovalModal.publishToPath.getElementInnerContent(),
        PublishingExpectedMessages.publishToPathIsValid,
      )
      .toBe(expectedPath);
  }

  public async assertRequestCreationDate(publicationRequest: Publication) {
    expect
      .soft(
        await this.publishingApprovalModal.publishDate.getElementInnerContent(),
        PublishingExpectedMessages.publishToPathIsValid,
      )
      .toBe(
        DateUtil.convertUnixTimestampToLocalDate(publicationRequest.createdAt),
      );
  }

  public async assertRequestCreationDateLabelState(
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.publishingApprovalModal.publishDateLabel,
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
    expect
      .soft(
        await this.publishingApprovalModal.goToReviewButton.getElementInnerContent(),
        ExpectedMessages.entityIsVisible,
      )
      .toBe(expectedTitle);
  }
}
